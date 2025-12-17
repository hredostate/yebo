
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { StudentTermReportDetails, GradingScheme, StudentInvoice, Student, StudentTermReport, Term, SchoolConfig } from '../types';
import Spinner from './common/Spinner';
import { LockClosedIcon, ShieldIcon } from './common/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getAttendanceStatus, getAttendanceProgressColor, type AttendanceData } from '../utils/attendanceHelpers';
import ResultSheetDesigns from './ResultSheetDesigns';

interface StudentReportViewProps {
  studentId: number;
  termId: number;
  onBack: () => void;
  isStudentUser?: boolean; // True if logged in user is a student
}

interface CompositeSubject {
  subjectName: string;
  term1Score: number | null;
  term2Score: number | null;
  term3Score: number; // Current term total
  cumulativeAverage: number;
  finalGrade: string;
  remark: string;
  subjectPosition?: number | null;
}

const PASTEL_COLORS = [
    '#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', 
    '#eecbff', '#feff9c', '#fff5ba', '#ffcbcb', '#c4faf8'
];

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
}

// Attendance Summary Component
const AttendanceSummary: React.FC<{ attendance: AttendanceData }> = ({ attendance }) => {
    const { present, absent, late, excused, unexcused, total, rate } = attendance;
    const status = getAttendanceStatus(rate);
    const computedSummary = attendance.computed;

    // Show a message if no attendance data
    if (total === 0) {
        return (
            <div className="mt-6 mb-6 border rounded-lg p-4 bg-slate-50 page-break-inside-avoid">
                <h4 className="text-center font-bold mb-3 text-slate-700 uppercase text-sm">ATTENDANCE SUMMARY</h4>
                <p className="text-center text-slate-500 py-4">No attendance records available for this term.</p>
            </div>
        );
    }
    
    return (
        <div className="mt-6 mb-6 border rounded-lg p-4 bg-slate-50 page-break-inside-avoid">
            <h4 className="text-center font-bold mb-4 text-slate-700 uppercase text-sm">ATTENDANCE SUMMARY</h4>

            {attendance.overrideApplied && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    Manual override applied for this term. Computed attendance was {computedSummary?.present ?? 0}/{computedSummary?.total ?? 0} days.
                </div>
            )}

            {/* Attendance Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 uppercase">Days Present</p>
                    <p className="text-2xl font-bold text-green-600">{present}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 uppercase">Days Absent</p>
                    <p className="text-2xl font-bold text-red-600">{absent}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 uppercase">Days Late</p>
                    <p className="text-2xl font-bold text-orange-600">{late}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 uppercase">Excused Absences</p>
                    <p className="text-2xl font-bold text-blue-600">{excused}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 uppercase">Unexcused Absences</p>
                    <p className="text-2xl font-bold text-red-700">{unexcused}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 uppercase">Total Days</p>
                    <p className="text-2xl font-bold text-slate-700">{total}</p>
                </div>
            </div>
            
            {/* Attendance Rate Bar */}
            <div className={`border-2 rounded-lg p-4 ${status.bgColor}`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Overall Attendance Rate</span>
                    <span className={`text-lg font-bold ${status.color}`}>{rate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-4 mb-2">
                    <div 
                        className={`h-4 rounded-full transition-all ${getAttendanceProgressColor(rate)}`}
                        style={{ width: `${Math.min(rate, 100)}%` }}
                    ></div>
                </div>
                <p className={`text-center text-sm font-semibold ${status.color}`}>
                    {status.emoji} {status.label}
                </p>
            </div>
        </div>
    );
};

const StudentReportView: React.FC<StudentReportViewProps> = ({ studentId, termId, onBack, isStudentUser = false }) => {
  const [reportDetails, setReportDetails] = useState<StudentTermReportDetails | null>(null);
  const [compositeData, setCompositeData] = useState<CompositeSubject[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGradingScheme, setActiveGradingScheme] = useState<GradingScheme | null>(null);
  const [isOwing, setIsOwing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [assessmentComponents, setAssessmentComponents] = useState<Array<{ name: string; max_score: number }> | null>(null);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  const handleSendToParent = async () => {
    if (!reportDetails?.student?.parent_phone_number_1) {
      alert('No parent phone number available for this student.');
      return;
    }

    if (!window.confirm('Send report card notification with download link to parent via SMS/WhatsApp?')) {
      return;
    }

    setIsSendingSms(true);
    
    try {
      const studentName = `${reportDetails.student.firstName} ${reportDetails.student.lastName}`;
      const termName = reportDetails.term.termName || 'Current Term';
      const sessionLabel = reportDetails.term.sessionLabel || '';
      
      // Generate a unique public token
      const publicToken = crypto.randomUUID();
      const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // Find or get the report ID
      const { data: reportData, error: reportError } = await supabase
        .from('student_term_reports')
        .select('id')
        .eq('student_id', studentId)
        .eq('term_id', termId)
        .maybeSingle();

      if (reportError) {
        throw reportError;
      }

      let reportId = reportData?.id;

      // If no report exists, we need to create one
      if (!reportId) {
        const { data: newReport, error: createError } = await supabase
          .from('student_term_reports')
          .insert({
            student_id: studentId,
            term_id: termId,
            academic_class_id: reportDetails.student.classId || 0,
            average_score: reportDetails.overallAverage || 0,
            total_score: reportDetails.overallTotal || 0,
            position_in_class: reportDetails.studentPosition || 0,
            is_published: true,
            public_token: publicToken,
            token_expires_at: tokenExpiresAt.toISOString()
          })
          .select('id')
          .single();

        if (createError) throw createError;
        reportId = newReport.id;
      } else {
        // Update existing report with token
        const { error: updateError } = await supabase
          .from('student_term_reports')
          .update({
            public_token: publicToken,
            token_expires_at: tokenExpiresAt.toISOString()
          })
          .eq('id', reportId);

        if (updateError) throw updateError;
      }

      // Build the public download link
      const downloadLink = `${window.location.origin}/report/${publicToken}`;
      
      // Get user for school_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not authenticated');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        alert('User profile not found');
        return;
      }

      // Use the report_card_ready template with variables
      const variables = {
        student_name: studentName,
        term: `${termName}, ${sessionLabel}`,
        class_name: reportDetails.student.className || '',
        download_link: downloadLink
      };

      // Send via smsService which will use the channel preferences
      const { sendNotificationWithChannel } = await import('../services/kudiSmsService');
      const result = await sendNotificationWithChannel('report_card_ready', {
        schoolId: profile.school_id,
        recipientPhone: reportDetails.student.parent_phone_number_1,
        templateName: 'report_card_ready',
        variables,
        studentId: studentId
      });

      if (result.success) {
        setSmsSent(true);
        alert(`Report card notification sent successfully via ${result.channel}!${result.fallback ? ' (fallback to SMS)' : ''}\n\nDownload link: ${downloadLink}`);
      } else {
        throw new Error(result.error || 'Failed to send notification');
      }
    } catch (err: any) {
      console.error('Error sending notification:', err);
      alert(`Failed to send notification: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSendingSms(false);
    }
  };

  useEffect(() => {
    const fetchReportAndStatus = async () => {
      setIsLoading(true);
      setError(null);
      
      // 0. Check Financial Status
      const { data: invoices, error: invError } = await supabase
          .from('student_invoices')
          .select('status')
          .eq('student_id', studentId)
          .eq('term_id', termId);
      
      if (invoices) {
          const owing = invoices.some(inv => inv.status !== 'Paid');
          if (owing) {
              setIsOwing(true);
              setIsLoading(false);
              return; // Stop fetching report data
          }
      }

      // 0.5 Check Published Status (Direct query to report table)
      const { data: reportMeta, error: reportError } = await supabase
          .from('student_term_reports')
          .select('is_published')
          .eq('student_id', studentId)
          .eq('term_id', termId)
          .maybeSingle();
      
      if (reportMeta && !reportMeta.is_published) {
           // If user is a student, block access completely
           if (isStudentUser) {
               setError('This report has not been published yet. Please check back later.');
               setIsLoading(false);
               return;
           }
           // Staff can view with indicator
           setIsPublished(false);
      } else {
           setIsPublished(true);
      }

      // 1. Fetch basic report details for the CURRENT term via RPC
      const { data, error: rpcError } = await supabase.rpc('get_student_term_report_details', {
        p_student_id: studentId,
        p_term_id: termId,
      });

      if (rpcError) {
        setError(rpcError.message);
        setIsLoading(false);
        return;
      }
      
      // 2. Fetch grading scheme to calculate final grades if needed
      if (data.schoolConfig.active_grading_scheme_id) {
          const { data: scheme } = await supabase.from('grading_schemes').select('*, rules:grading_scheme_rules(*)').eq('id', data.schoolConfig.active_grading_scheme_id).maybeSingle();
          if (scheme) {
              setActiveGradingScheme(scheme);
          }
      }

      // 3. Fetch Class Config (Layout/Design) - FIXED VERSION
      // First, get the academic_class_id from academic_class_students
      const { data: enrollment } = await supabase
          .from('academic_class_students')
          .select('academic_class_id')
          .eq('student_id', studentId)
          .eq('enrolled_term_id', termId)
          .maybeSingle();

      if (enrollment?.academic_class_id) {
          const { data: classData } = await supabase
              .from('academic_classes')
              .select('report_config, assessment_structure_id')
              .eq('id', enrollment.academic_class_id)
              .maybeSingle();
          
          if (classData?.report_config) {
              data.classReportConfig = classData.report_config;
          }
          
          // Fetch assessment structure to get component definitions
          if (classData?.assessment_structure_id) {
              const { data: assessmentStructure } = await supabase
                  .from('assessment_structures')
                  .select('components')
                  .eq('id', classData.assessment_structure_id)
                  .maybeSingle();
              
              if (assessmentStructure?.components) {
                  setAssessmentComponents(assessmentStructure.components);
              }
          }
      }

      setReportDetails(data);

      // 4. Check if this is a "Third Term" or "3rd Term" to trigger composite logic
      const isThirdTerm = data.term.termLabel.toLowerCase().includes('third') || data.term.termLabel.toLowerCase().includes('3rd');
      
      if (isThirdTerm && data.schoolConfig.term_weights) {
          await calculateComposite(data, data.schoolConfig.term_weights);
      }

      setIsLoading(false);
    };

    fetchReportAndStatus();
  }, [studentId, termId]);

  const calculateComposite = async (currentReport: StudentTermReportDetails, weights: { term1: number, term2: number, term3: number }) => {
      // 1. Find sibling terms in the same session
      const { data: allTerms } = await supabase
        .from('terms')
        .select('id, term_label')
        .eq('school_id', currentReport.schoolConfig.school_id)
        .eq('session_label', currentReport.term.sessionLabel);
      
      if (!allTerms) return;

      const term1 = allTerms.find(t => t.term_label.toLowerCase().includes('first') || t.term_label.toLowerCase().includes('1st'));
      const term2 = allTerms.find(t => t.term_label.toLowerCase().includes('second') || t.term_label.toLowerCase().includes('2nd'));
      
      // 2. Fetch scores for previous terms
      // We need subject totals. RPC `get_student_term_report_details` is heavy, maybe just query `score_entries` directly
      const { data: term1Scores } = term1 ? await supabase.from('score_entries').select('subject_name, total_score').eq('student_id', studentId).eq('term_id', term1.id) : { data: [] };
      const { data: term2Scores } = term2 ? await supabase.from('score_entries').select('subject_name, total_score').eq('student_id', studentId).eq('term_id', term2.id) : { data: [] };

      // 3. Merge and Calculate
      const composite: CompositeSubject[] = currentReport.subjects.map(sub => {
          const t1 = term1Scores?.find(s => s.subject_name === sub.subjectName)?.total_score || null;
          const t2 = term2Scores?.find(s => s.subject_name === sub.subjectName)?.total_score || null;
          const t3 = sub.totalScore;

          // Weighted Average Calculation
          // If a term is missing, do we normalize? Usually, standard is (T1*W1 + T2*W2 + T3*W3) / 100
          // If score is missing, treat as 0? Or skip? Let's assume 0 for simplicity or 'N/A' logic.
          
          const w1 = weights.term1 / 100;
          const w2 = weights.term2 / 100;
          const w3 = weights.term3 / 100;

          const val1 = t1 || 0;
          const val2 = t2 || 0;
          
          const cumulativeAvg = (val1 * w1) + (val2 * w2) + (t3 * w3);
          
          // Determine Grade for Cumulative
          let finalGrade = '-';
          let remark = '-';
          if (activeGradingScheme) {
              const rule = activeGradingScheme.rules.find(r => cumulativeAvg >= r.min_score && cumulativeAvg <= r.max_score);
              if (rule) {
                  finalGrade = rule.grade_label;
                  remark = rule.remark || '';
              }
          }

          return {
              subjectName: sub.subjectName,
              term1Score: t1,
              term2Score: t2,
              term3Score: t3,
              cumulativeAverage: Number(cumulativeAvg.toFixed(2)),
              finalGrade,
              remark,
              subjectPosition: sub.subjectPosition
          };
      });

      setCompositeData(composite);
  };

  // Helper to format ordinal suffix (1st, 2nd, 3rd)
  const getOrdinal = (n: number | null | undefined) => {
    if (!n) return '-';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };


  if (isLoading) return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;

  if (isOwing) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-4 text-center">
              <LockClosedIcon className="w-24 h-24 text-red-500 mb-4" />
              <h1 className="text-3xl font-bold text-slate-900">Financial Clearance Required</h1>
              <p className="text-slate-600 mt-2 max-w-md">
                  Access to this report card is restricted due to outstanding fees. Please contact the bursary department to clear your balance.
              </p>
              <button onClick={onBack} className="mt-8 px-6 py-2 bg-slate-800 text-white rounded-lg">Go Back</button>
          </div>
      );
  }

  if (error || !reportDetails) return <div className="text-red-500 text-center p-10">Error: {error || 'Report not found'}</div>;

  const { student, term, summary, attendance, comments, subjects, classReportConfig } = reportDetails;

  // Dynamic Styles from Config
  const themeColor = classReportConfig?.colorTheme || '#1E3A8A';
  const containerStyle = { borderColor: themeColor };
  const showPhoto = classReportConfig?.showPhoto !== false;
  const showPosition = classReportConfig?.showPosition !== false;
  const showGraph = classReportConfig?.showGraph || false;
  const layout = classReportConfig?.layout || 'classic';
  const orientation = classReportConfig?.orientation || 'portrait';
  const admissionNumber = (reportDetails as any)?.student?.admissionNumber || 'N/A';
  
  // Overrides
  const schoolName = classReportConfig?.schoolNameOverride || reportDetails.schoolConfig.display_name || 'University Preparatory Secondary School';
  const logoUrl = classReportConfig?.customLogoUrl || reportDetails.schoolConfig.logo_url;
  const principalTitle = classReportConfig?.principalLabel || 'Principal';
  const teacherTitle = classReportConfig?.teacherLabel || 'Class Teacher';
  const principalNameOverride = classReportConfig?.principalNameOverride;
  const teacherNameOverride = classReportConfig?.teacherNameOverride;

  const commonTableClasses = "w-full text-sm border-collapse";
  const commonThClasses = "p-2 border border-slate-300 text-left text-xs uppercase";
  const commonTdClasses = "p-2 border border-slate-300";

  const renderTableBody = () => {
      if (!compositeData) {
          // Standard Term - show component breakdown
          return (
             <tbody>
                {subjects.map((sub, idx) => {
                    let rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    if (layout === 'pastel') {
                        rowClass = ''; // Handled by inline style or specialized logic
                    }
                    const pastelStyle = layout === 'pastel' ? { backgroundColor: PASTEL_COLORS[idx % PASTEL_COLORS.length] + '40' } : {};

                    // Calculate CA and Exam scores from componentScores for fallback
                    let caScore = 0;
                    let examScore = 0;
                    if (sub.componentScores) {
                        Object.entries(sub.componentScores).forEach(([key, value]) => {
                            if (key.toLowerCase().includes('exam')) {
                                examScore += value;
                            } else {
                                caScore += value;
                            }
                        });
                    }

                    return (
                    <tr key={idx} className={rowClass} style={pastelStyle}>
                        <td className={`${commonTdClasses} text-center`}>{idx + 1}</td>
                        <td className={commonTdClasses}>{sub.subjectName}</td>
                        {assessmentComponents && assessmentComponents.length > 0 ? (
                            // Dynamic component scores
                            assessmentComponents.map((comp, compIdx) => (
                                <td key={compIdx} className={`${commonTdClasses} text-center`}>
                                    {sub.componentScores?.[comp.name] ?? '-'}
                                </td>
                            ))
                        ) : (
                            // Fallback to CA/Exam
                            <>
                                <td className={`${commonTdClasses} text-center`}>{sub.componentScores ? caScore : '-'}</td>
                                <td className={`${commonTdClasses} text-center`}>{sub.componentScores ? examScore : '-'}</td>
                            </>
                        )}
                        <td className={`${commonTdClasses} text-center font-bold`}>{sub.totalScore}</td>
                        <td className={`${commonTdClasses} text-center`}>
                            <span className={`px-2 py-0.5 rounded font-bold ${
                                sub.gradeLabel === 'A' ? 'bg-green-100 text-green-800' :
                                sub.gradeLabel === 'B' ? 'bg-blue-100 text-blue-800' :
                                sub.gradeLabel === 'C' ? 'bg-amber-100 text-amber-800' :
                                sub.gradeLabel === 'D' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                            }`}>
                                {sub.gradeLabel}
                            </span>
                        </td>
                        <td className={`${commonTdClasses} text-center text-slate-500 text-xs`}>{getOrdinal(sub.subjectPosition)}</td>
                        <td className={`${commonTdClasses} text-xs italic`}>{sub.remark}</td>
                    </tr>
                )})}
            </tbody>
          )
      } else {
          // Keep existing composite data body logic for third term reports
          return (
            <tbody>
                {compositeData.map((sub, idx) => {
                    let rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    if (layout === 'pastel') {
                        rowClass = ''; 
                    }
                    const pastelStyle = layout === 'pastel' ? { backgroundColor: PASTEL_COLORS[idx % PASTEL_COLORS.length] + '40' } : {};

                    return (
                    <tr key={idx} className={rowClass} style={pastelStyle}>
                        <td className={commonTdClasses}>{sub.subjectName}</td>
                        <td className={`${commonTdClasses} text-center text-slate-500`}>{sub.term1Score ?? '-'}</td>
                        <td className={`${commonTdClasses} text-center text-slate-500`}>{sub.term2Score ?? '-'}</td>
                        <td className={`${commonTdClasses} text-center`}>{sub.term3Score}</td>
                        <td className={`${commonTdClasses} text-center font-bold ${layout === 'pastel' ? '' : 'bg-blue-50'}`}>{sub.cumulativeAverage}</td>
                        <td className={`${commonTdClasses} text-center text-slate-500 text-xs`}>{getOrdinal(sub.subjectPosition)}</td>
                        <td className={`${commonTdClasses} text-center font-bold ${sub.finalGrade === 'F' ? 'text-red-600' : ''}`}>{sub.finalGrade}</td>
                        <td className={`${commonTdClasses} text-xs italic`}>{sub.remark}</td>
                    </tr>
                )})}
            </tbody>
          )
      }
  }

  const renderTableHeader = () => {
       let headerStyle: React.CSSProperties = {};
       if (layout === 'modern') {
           headerStyle = { backgroundColor: themeColor, color: 'white' };
       } else if (layout === 'pastel') {
           headerStyle = { backgroundColor: themeColor + '20', color: 'black' }; // Light tint of theme
       } else {
           headerStyle = { backgroundColor: '#f1f5f9', color: '#334155' };
       }

       if (!compositeData) {
           return (
                <thead>
                    <tr style={headerStyle}>
                        <th className={`${commonThClasses} w-8 text-center`}>S/N</th>
                        <th className={commonThClasses}>Subject</th>
                        {assessmentComponents && assessmentComponents.length > 0 ? (
                            // Dynamic component columns (CA1, CA2, Exam, etc.)
                            assessmentComponents.map((comp, idx) => (
                                <th key={idx} className={`${commonThClasses} text-center w-16`}>
                                    {comp.name}
                                    <br />
                                    <span className="text-[10px] font-normal">/{comp.max_score}</span>
                                </th>
                            ))
                        ) : (
                            // Fallback to simple CA/Exam columns if no assessment structure
                            <>
                                <th className={`${commonThClasses} text-center w-16`}>CA</th>
                                <th className={`${commonThClasses} text-center w-16`}>Exam</th>
                            </>
                        )}
                        <th className={`${commonThClasses} text-center w-16`}>Total</th>
                        <th className={`${commonThClasses} text-center w-14`}>Grade</th>
                        <th className={`${commonThClasses} text-center w-14`}>Pos</th>
                        <th className={commonThClasses}>Remark</th>
                    </tr>
                </thead>
           )
       }
       // Keep existing composite data header logic for third term reports
       return (
            <thead>
                <tr style={headerStyle}>
                    <th className={commonThClasses}>Subject</th>
                    <th className={`${commonThClasses} text-center w-12`}>1st</th>
                    <th className={`${commonThClasses} text-center w-12`}>2nd</th>
                    <th className={`${commonThClasses} text-center w-12`}>3rd</th>
                    <th className={`${commonThClasses} text-center w-16`}>Cum.</th>
                    <th className={`${commonThClasses} text-center w-16`}>Pos</th>
                    <th className={`${commonThClasses} text-center w-12`}>Grd</th>
                    <th className={commonThClasses}>Remark</th>
                </tr>
            </thead>
       )
  }

  // --- LAYOUT COMPONENTS ---

  const HeaderSection = () => (
        <div
          className="relative overflow-hidden"
          style={{
            background: `linear-gradient(120deg, ${themeColor}, ${themeColor}dd 45%, #0f172a)`
          }}
        >
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white, transparent 25%), radial-gradient(circle at 80% 0%, white, transparent 20%), radial-gradient(circle at 50% 80%, white, transparent 25%)' }}></div>
            <div className="relative p-6 md:p-8 text-white flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex items-center gap-4 flex-1">
                        {logoUrl ? (
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/10 backdrop-blur border border-white/30 flex items-center justify-center overflow-hidden">
                                <img src={logoUrl} alt="School Logo" className="w-18 h-18 md:w-20 md:h-20 object-contain" />
                            </div>
                        ) : (
                            <div className="w-20 h-20 md:w-24 md:h-24 bg-white/10 rounded-2xl flex items-center justify-center border border-white/30">
                                <ShieldIcon className="w-12 h-12 text-white" />
                            </div>
                        )}

                        <div className="space-y-1">
                            <p className="uppercase tracking-[0.25em] text-xs font-semibold opacity-80">Official Report Card</p>
                            <h1 className="text-2xl md:text-3xl font-black leading-tight drop-shadow-sm">{schoolName}</h1>
                            <p className="text-sm md:text-base text-white/80 italic">{reportDetails.schoolConfig.motto}</p>
                            <p className="text-xs md:text-sm text-white/70">{reportDetails.schoolConfig.address}</p>
                            <div className="mt-3 flex flex-wrap gap-3">
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/15 border border-white/20">
                                    {term.sessionLabel} • {term.termLabel}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/20">
                                    {student.className}
                                </span>
                                {!isPublished && (
                                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-200 text-amber-900 border border-yellow-300">Unpublished Preview</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {showPhoto && (
                        <div className="w-full md:w-32">
                            <div className="ml-auto w-28 h-36 md:w-32 md:h-40 rounded-2xl border-2 border-dashed border-white/50 bg-white/10 backdrop-blur flex items-center justify-center text-[10px] uppercase tracking-wide text-white/70">
                                Student Photo
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
  );

  const StudentInfoGrid = () => (
      <div className="px-6 md:px-8 -mt-8 relative z-10">
        <div className="grid md:grid-cols-[2fr,1.1fr] gap-4">
            <div className="bg-white shadow-xl rounded-2xl border border-slate-200 p-4 md:p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Student</p>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-snug">{student.fullName}</h2>
                        <p className="text-sm text-slate-600">{student.className} • {term.termLabel} ({term.sessionLabel})</p>
                    </div>
                    <div className="text-right text-xs space-y-1">
                        <div className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold inline-flex items-center gap-1">
                            <span className="text-[10px]">ID</span>
                            <span>{admissionNumber}</span>
                        </div>
                        <div className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold inline-flex items-center gap-1">
                            <span>Attendance</span>
                            <span>{attendance.rate.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold">🏫</span>
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Campus / Class</p>
                            <p className="font-bold">{student.className}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold">📅</span>
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Term</p>
                            <p className="font-bold">{term.termLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold">🎯</span>
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Goal</p>
                            <p className="font-bold">Personal excellence</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-white shadow-xl rounded-2xl border border-slate-200 p-4 md:p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3 font-semibold">Quick Metrics</p>
                <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                        <p className="text-[11px] uppercase text-slate-500 font-semibold">Total Score</p>
                        <p className="text-2xl font-black text-slate-900">{summary.average * subjects.length}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                        <p className="text-[11px] uppercase text-slate-500 font-semibold">Average</p>
                        <p className="text-2xl font-black text-slate-900">{Number(summary.average).toFixed(2)}%</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                        <p className="text-[11px] uppercase text-slate-500 font-semibold">GPA</p>
                        <p className="text-2xl font-black text-slate-900">{summary.gpaAverage ? Number(summary.gpaAverage).toFixed(2) : 'N/A'}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                        <p className="text-[11px] uppercase text-slate-500 font-semibold">Attendance</p>
                        <p className="text-2xl font-black text-slate-900">{attendance.present}/{attendance.total}</p>
                        <p className="text-[11px] text-slate-500">Present / Total</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  const SummaryCards = () => (
    <div className="px-6 md:px-8 mt-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 shadow bg-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: themeColor + '22', color: themeColor }}>
                📊
            </div>
            <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Performance Index</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black text-slate-900">{Number(summary.average).toFixed(1)}%</p>
                    <span className="text-xs text-slate-500">across {subjects.length} subjects</span>
                </div>
            </div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 shadow bg-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#22c55e22', color: '#16a34a' }}>
                🏆
            </div>
            <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Standing</p>
                <div className="flex items-center gap-3">
                    <p className="text-2xl font-black text-slate-900">{showPosition && summary.positionInArm ? getOrdinal(summary.positionInArm) : 'N/A'}</p>
                    {summary.positionInGradeLevel && (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">Grade: {getOrdinal(summary.positionInGradeLevel)}</span>
                    )}
                </div>
                <p className="text-xs text-slate-500">Class size: {summary.gradeLevelSize || 'N/A'}</p>
            </div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 shadow bg-white flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#38bdf822', color: '#0284c7' }}>
                        ⏱️
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Attendance Velocity</p>
                        <p className="text-xl font-black text-slate-900">{attendance.rate.toFixed(1)}%</p>
                    </div>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold">{attendance.present} / {attendance.total}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full" style={{ width: `${Math.min(attendance.rate, 100)}%`, backgroundColor: themeColor }}></div>
            </div>
            <p className="text-xs text-slate-500">Lates: {attendance.late} • Excused: {attendance.excused} • Unexcused: {attendance.unexcused}</p>
        </div>
      </div>
    </div>
  );

  const SignatoriesSection = () => (
    <div className={`grid ${orientation === 'landscape' ? 'grid-cols-2' : 'grid-cols-1'} gap-6 px-6 pb-8 mt-6`}>
        <div className={`p-4 border rounded-lg h-full flex flex-col ${layout === 'pastel' ? 'border-slate-200 bg-slate-50/50' : 'border-slate-300'}`}>
            <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">{teacherTitle}'s Remark</h4>
            <p className="text-sm text-slate-600 italic flex-grow min-h-[3em]">{comments.teacher || "No comment provided."}</p>
            <div className="mt-4 pt-2 border-t border-dashed border-slate-300 flex justify-between items-end">
                <p className="text-xs font-bold text-slate-400">SIGNATURE & DATE</p>
                {teacherNameOverride && <p className="text-xs font-medium text-slate-600">{teacherNameOverride}</p>}
            </div>
        </div>
        <div className={`p-4 border rounded-lg h-full flex flex-col ${layout === 'pastel' ? 'border-slate-200 bg-slate-50/50' : 'border-slate-300'}`}>
            <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">{principalTitle}'s Remark</h4>
            <p className="text-sm text-slate-600 italic flex-grow min-h-[3em]">{comments.principal || "No comment provided."}</p>
             <div className="mt-4 pt-2 border-t border-dashed border-slate-300 flex justify-between items-end">
                <p className="text-xs font-bold text-slate-400">SIGNATURE & DATE</p>
                 {principalNameOverride && <p className="text-xs font-medium text-slate-600">{principalNameOverride}</p>}
            </div>
        </div>
    </div>
  );

  const Footer = () => (
    <div className="text-white text-center py-2 text-[10px]" style={{ backgroundColor: layout === 'pastel' ? themeColor : '#1e293b' }}>
        {schoolName} • Generated on {new Date().toLocaleDateString()}
    </div>
  );

  // Transform data from StudentReportView format to ResultSheetDesigns format
  const transformDataForPrintableDesign = () => {
    // Create Student object in the format expected by ResultSheetDesigns
    const studentData: Student = {
      id: student.id,
      school_id: reportDetails.schoolConfig.school_id,
      name: student.fullName,
      admission_number: '', // Not available in StudentTermReportDetails
      grade: student.className,
      reward_points: 0,
    };

    // Create Term object
    const termData: Term = {
      id: termId,
      school_id: reportDetails.schoolConfig.school_id,
      session_label: term.sessionLabel,
      term_label: term.termLabel,
      start_date: '',
      end_date: '',
      is_active: false,
    };

    // Create StudentTermReport object
    const reportData: StudentTermReport = {
      id: 0,
      student_id: student.id,
      term_id: termId,
      academic_class_id: 0,
      average_score: summary.average,
      total_score: subjects.reduce((sum, s) => sum + s.totalScore, 0),
      position_in_class: summary.positionInArm,
      teacher_comment: comments.teacher,
      principal_comment: comments.principal,
      is_published: isPublished,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Transform subjects to the format expected by ResultSheetDesigns
    const transformedSubjects = subjects.map(sub => {
      // Extract CA and Exam scores from componentScores if available
      let caScore = 0;
      let examScore = 0;
      
      if (sub.componentScores) {
        // Sum all non-exam components as CA score
        Object.entries(sub.componentScores).forEach(([key, value]) => {
          if (key.toLowerCase().includes('exam')) {
            examScore += value;
          } else {
            caScore += value;
          }
        });
      }
      
      return {
        subject_name: sub.subjectName,
        component_scores: sub.componentScores,
        ca_score: caScore,
        exam_score: examScore,
        total_score: sub.totalScore,
        grade: sub.gradeLabel,
        remark: sub.remark,
        subject_position: sub.subjectPosition,
      };
    });

    // Use gradeLevelSize as a fallback for classSize if available, otherwise use 1 to avoid division by zero
    // Note: classSize is not available in StudentTermReportDetails. Using gradeLevelSize provides
    // a reasonable approximation. If neither is available, we use 1 which will display position as "X of 1"
    // This is acceptable since the actual class size is not exposed in the current data structure
    const estimatedClassSize = summary.gradeLevelSize || 1;

    return {
      report: reportData,
      student: studentData,
      subjects: transformedSubjects,
      assessmentComponents,
      gradingScheme: activeGradingScheme!,
      schoolConfig: reportDetails.schoolConfig,
      term: termData,
      classPosition: summary.positionInArm,
      classSize: estimatedClassSize,
      gradeLevelPosition: summary.positionInGradeLevel || undefined,
      gradeLevelSize: summary.gradeLevelSize,
    };
  };

  // Render the appropriate printable design based on layout
  const renderPrintableDesign = () => {
    if (!activeGradingScheme) {
      return <div>Loading grading scheme...</div>;
    }

    const props = transformDataForPrintableDesign();

    // Map layout options to the correct design component
    // Note: ResultSheetDesigns exports 4 designs: modern, banded, executive, minimalist
    // We map the 9 layout options to these 4 designs based on visual similarity
    switch (layout) {
      case 'modern-gradient':
        // Advanced layout: Modern Gradient uses the modern design component
        return <ResultSheetDesigns.modern {...props} />;
      case 'banded-rows':
        // Advanced layout: Banded Rows uses the banded design component
        return <ResultSheetDesigns.banded {...props} />;
      case 'executive-dark':
        // Advanced layout: Executive Dark uses the executive design component
        return <ResultSheetDesigns.executive {...props} />;
      case 'minimalist-clean':
        // Advanced layout: Minimalist Clean uses the minimalist design component
        return <ResultSheetDesigns.minimalist {...props} />;
      case 'classic':
      case 'compact':
        // Standard layouts: Classic and Compact use formal banded-rows design for printing
        return <ResultSheetDesigns.banded {...props} />;
      case 'modern':
        // Standard layout: Modern uses modern-gradient design for printing
        return <ResultSheetDesigns.modern {...props} />;
      case 'professional':
        // Standard layout: Professional uses executive design for printing
        return <ResultSheetDesigns.executive {...props} />;
      case 'pastel':
        // Standard layout: Pastel uses minimalist design for printing
        return <ResultSheetDesigns.minimalist {...props} />;
      default:
        // Default to banded-rows for any unrecognized layout
        return <ResultSheetDesigns.banded {...props} />;
    }
  };


  return (
    <div className="report-print-root min-h-screen bg-gray-100 p-4 md:p-8 print:bg-white print:p-0 font-sans">
      
      {/* Dynamic Print Style Injection */}
      <style>
        {`
          @media print {
            @page {
              size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'};
              margin: 6mm;
            }
            
            /* Force colors to print */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            body {
              background: white !important;
            }
            
            /* Hide screen-only elements */
            .no-print {
              display: none !important;
            }
            
            .printable-report {
              width: 100% !important;
              max-width: none !important;
              border: none !important;
              box-shadow: none !important;
              margin: 0 !important;
            }
            
            /* Prevent page breaks inside elements */
            .page-break-inside-avoid {
              page-break-inside: avoid;
            }
            
            /* Ensure grid layouts display properly in print */
            .grid {
              display: grid !important;
            }
            
            /* Preserve background colors for cards and sections */
            .bg-white,
            .bg-slate-50,
            .bg-slate-100,
            .bg-slate-200,
            .bg-gray-50,
            .bg-gray-100,
            .bg-blue-50,
            .bg-blue-100,
            .bg-green-50,
            .bg-green-100,
            .bg-yellow-50,
            .bg-yellow-100,
            .bg-red-50,
            .bg-red-100,
            .bg-orange-50,
            .bg-orange-100,
            .bg-amber-50,
            .bg-amber-100,
            .bg-purple-50 {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            /* Ensure charts render properly */
            .recharts-wrapper,
            .recharts-surface {
              page-break-inside: avoid !important;
            }
            
            /* Preserve borders with actual colors */
            .border-slate-200 {
              border-color: #e2e8f0 !important;
            }
            .border-slate-300 {
              border-color: #cbd5e1 !important;
            }
            .border-black {
              border-color: #000 !important;
            }
            
            /* Maintain rounded corners */
            .rounded,
            .rounded-lg,
            .rounded-xl {
              border-radius: inherit !important;
            }
          }
        `}
      </style>

      <div className="mx-auto print:w-full print:max-w-none max-w-[210mm]">
        
        <div className="mb-4 flex justify-between items-center no-print">
          <button onClick={onBack} className="px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 text-slate-700 font-medium">
            &larr; Back
          </button>
          <div className="flex gap-2">
            {!isPublished && <span className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-bold border border-yellow-300">Unpublished Preview</span>}
            {smsSent && <span className="px-3 py-2 bg-green-100 text-green-800 rounded-lg font-medium border border-green-300">✓ Sent to Parent</span>}
            {!isStudentUser && reportDetails?.student?.parent_phone_number_1 && (
              <button 
                onClick={handleSendToParent}
                disabled={isSendingSms}
                className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 font-medium disabled:bg-green-400 flex items-center gap-2"
              >
                {isSendingSms ? (
                  <>
                    <Spinner size="sm" />
                    Sending...
                  </>
                ) : (
                  <>
                    📱 Send to Parent
                  </>
                )}
              </button>
            )}
            <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 font-medium">
                Print Report
            </button>
          </div>
        </div>

        {/* Screen and print view - visible in both modes */}
        <div>
          <div className="a4-print-page" style={orientation === 'landscape' ? { width: '297mm', minHeight: '210mm', maxHeight: '210mm' } : undefined}>
            <div className={`a4-print-safe-area bg-white shadow-2xl print:shadow-none rounded-xl overflow-hidden printable-report ${layout === 'professional' ? 'border-4 border-double border-black' : 'border-t-8'}`} style={layout !== 'professional' ? containerStyle : {}}>
            
            {/* --- CLASSIC, MODERN & PASTEL LAYOUTS SHARE STRUCTURE --- */}
            {(layout === 'classic' || layout === 'modern' || layout === 'pastel') && (
                <>
                      <HeaderSection />
                      <StudentInfoGrid />
                      <SummaryCards />
                      {showGraph && (
                          <div className="px-6 pb-4">
                              <PerformanceChart
                                  data={subjects.map(s => ({ name: s.subjectName, score: s.totalScore }))}
                                  themeColor={themeColor}
                              />
                          </div>
                      )}
                      <div className="px-6 pb-4">
                          <AttendanceSummary attendance={attendance} />
                      </div>
                      <div className="px-6 pb-8">
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                              <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-200" style={{ backgroundColor: themeColor + '0D' }}>
                                  <div>
                                      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Scholastic Record</p>
                                      <h3 className="text-lg md:text-xl font-black text-slate-900">Academic Performance</h3>
                                  </div>
                                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                      {subjects.length} Subjects
                                  </span>
                              </div>
                              <div className="overflow-x-auto">
                                  <table className={`${commonTableClasses} min-w-full`}>
                                      {renderTableHeader()}
                                      {renderTableBody()}
                                  </table>
                              </div>
                          </div>
                      </div>
                      <SignatoriesSection />
                      <Footer />
                  </>
              )}

            {/* --- COMPACT LAYOUT --- */}
            {layout === 'compact' && (
                <div className="p-6">
                    <div className="flex justify-between border-b-2 border-black pb-4 mb-4">
                         <div className="flex gap-4 items-center">
                            {logoUrl && <img src={logoUrl} className="w-16 h-16 object-contain"/>}
                            <div>
                                <h1 className="text-xl font-bold uppercase">{schoolName}</h1>
                                <p className="text-xs text-gray-600">{reportDetails.schoolConfig.address}</p>
                            </div>
                         </div>
                         <div className="text-right">
                             <h2 className="font-bold text-lg uppercase">{term.termLabel} Report</h2>
                             <p className="text-sm">{term.sessionLabel}</p>
                         </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4 text-sm border p-2">
                        <div>Name: <strong>{student.fullName}</strong></div>
                        <div>Class: <strong>{student.className}</strong></div>
                        <div>Avg: <strong>{Number(summary.average).toFixed(2)}%</strong></div>
                        <div>Pos (Arm): <strong>{getOrdinal(summary.positionInArm)}</strong></div>
                        {summary.positionInGradeLevel && <div>Pos (Grade): <strong>{getOrdinal(summary.positionInGradeLevel)}</strong></div>}
                        <div>Att: <strong>{attendance.rate.toFixed(1)}% ({attendance.present}/{attendance.total})</strong></div>
                    </div>
                    
                    <AttendanceSummary attendance={attendance} />
                    
                    {showGraph && (
                        <div className="mb-4">
                            <PerformanceChart 
                                data={subjects.map(s => ({ name: s.subjectName, score: s.totalScore }))} 
                                themeColor={themeColor} 
                            />
                        </div>
                    )}

                    <div className="mb-4">
                        <table className="w-full text-xs border-collapse border border-black">
                             {renderTableHeader()}
                             {renderTableBody()}
                        </table>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="border p-2">
                            <strong className="block border-b mb-1">{teacherTitle}:</strong>
                            <p className="italic">{comments.teacher}</p>
                        </div>
                        <div className="border p-2">
                            <strong className="block border-b mb-1">{principalTitle}:</strong>
                            <p className="italic">{comments.principal}</p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- PROFESSIONAL LAYOUT --- */}
            {layout === 'professional' && (
                <div className="p-8 font-serif text-black">
                    <div className="text-center mb-8 border-b-2 border-black pb-6">
                        <h1 className="text-3xl font-bold uppercase tracking-widest mb-2">{schoolName}</h1>
                        <p className="text-sm uppercase tracking-wide">{reportDetails.schoolConfig.address}</p>
                        <div className="mt-4 inline-block border-y border-black py-1 px-8">
                             <h2 className="text-xl font-bold uppercase">Student Performance Report</h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8 text-sm uppercase tracking-wide">
                        <div>
                            <p><span className="font-bold inline-block w-32">Student Name:</span> {student.fullName}</p>
                            <p><span className="font-bold inline-block w-32">Class:</span> {student.className}</p>
                             <p><span className="font-bold inline-block w-32">Admission No:</span> N/A</p>
                        </div>
                         <div>
                            <p><span className="font-bold inline-block w-32">Session:</span> {term.sessionLabel}</p>
                            <p><span className="font-bold inline-block w-32">Term:</span> {term.termLabel}</p>
                             <p><span className="font-bold inline-block w-32">Date:</span> {new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                    
                    {showGraph && (
                        <div className="mb-8 border border-black p-2">
                             <p className="text-xs font-bold uppercase mb-2">Performance Summary</p>
                            <PerformanceChart 
                                data={subjects.map(s => ({ name: s.subjectName, score: s.totalScore }))} 
                                themeColor="#000" 
                            />
                        </div>
                    )}
                    
                    <div className="mb-8">
                        <AttendanceSummary attendance={attendance} />
                    </div>

                    <table className="w-full text-sm border-collapse border border-black mb-8">
                        {renderTableHeader()}
                        {renderTableBody()}
                    </table>
                    
                    <div className="grid grid-cols-4 gap-4 mb-8 text-center border border-black p-4 bg-gray-50">
                        <div>
                            <p className="text-xs font-bold uppercase">Total</p>
                            <p className="text-lg font-bold">{summary.average * subjects.length}</p>
                        </div>
                         <div>
                            <p className="text-xs font-bold uppercase">Average</p>
                            <p className="text-lg font-bold">{Number(summary.average).toFixed(2)}%</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase">Pos (Arm/Grade)</p>
                            <p className="text-lg font-bold">{getOrdinal(summary.positionInArm)} / {summary.positionInGradeLevel ? getOrdinal(summary.positionInGradeLevel) : '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase">GPA</p>
                            <p className="text-lg font-bold">{summary.gpaAverage}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                         <div>
                            <p className="font-bold uppercase text-xs border-b border-black mb-1">{teacherTitle}'s Remarks</p>
                            <p className="italic text-sm">{comments.teacher}</p>
                        </div>
                         <div>
                            <p className="font-bold uppercase text-xs border-b border-black mb-1">{principalTitle}'s Remarks</p>
                            <p className="italic text-sm">{comments.principal}</p>
                        </div>
                    </div>
                    
                    <div className="mt-12 flex justify-between items-end">
                        <div className="text-center">
                            <div className="w-48 border-b border-black mb-1"></div>
                            <p className="text-xs uppercase">{principalNameOverride || principalTitle}</p>
                        </div>
                        <div className="text-xs">
                             Officially Generated Document
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default StudentReportView;
