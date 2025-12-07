
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { StudentTermReportDetails, GradingScheme, StudentInvoice } from '../types';
import Spinner from './common/Spinner';
import { LockClosedIcon, ShieldIcon } from './common/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

const StudentReportView: React.FC<StudentReportViewProps> = ({ studentId, termId, onBack, isStudentUser = false }) => {
  const [reportDetails, setReportDetails] = useState<StudentTermReportDetails | null>(null);
  const [compositeData, setCompositeData] = useState<CompositeSubject[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGradingScheme, setActiveGradingScheme] = useState<GradingScheme | null>(null);
  const [isOwing, setIsOwing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [assessmentComponents, setAssessmentComponents] = useState<Array<{ name: string; max_score: number }> | null>(null);

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

      // 3. Fetch Class Config (Layout/Design)
      // We need the AcademicClass record for this report to get `report_config`
      // The RPC return might not have it fully. Let's fetch it.
      if (data.student.className) {
           // Best effort lookup by name (RPC returns name string)
           // Or fetch from `academic_class_students` -> `academic_classes`
           const { data: classData } = await supabase.from('academic_classes')
             .select('report_config, assessment_structure_id')
             .eq('session_label', data.term.sessionLabel)
             .textSearch('name', data.student.className) // Rough match, ideally we'd have classId in RPC
             .limit(1)
             .maybeSingle();
             
           if (classData && classData.report_config) {
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
          // Standard Term
          return (
             <tbody>
                {subjects.map((sub, idx) => {
                    let rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    if (layout === 'pastel') {
                        rowClass = ''; // Handled by inline style or specialized logic
                    }
                    const pastelStyle = layout === 'pastel' ? { backgroundColor: PASTEL_COLORS[idx % PASTEL_COLORS.length] + '40' } : {};

                    return (
                    <tr key={idx} className={rowClass} style={pastelStyle}>
                        <td className={commonTdClasses}>{sub.subjectName}</td>
                        <td className={`${commonTdClasses} text-center font-bold`}>{sub.totalScore}</td>
                        <td className={`${commonTdClasses} text-center text-slate-500 text-xs`}>{getOrdinal(sub.subjectPosition)}</td>
                        <td className={`${commonTdClasses} text-center font-bold ${sub.gradeLabel === 'F' ? 'text-red-600' : ''}`}>{sub.gradeLabel}</td>
                        <td className={`${commonTdClasses} text-xs italic`}>{sub.remark}</td>
                    </tr>
                )})}
            </tbody>
          )
      } else {
          // Composite
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
                        <th className={commonThClasses}>Subject</th>
                        <th className={`${commonThClasses} text-center w-24`}>Total Score</th>
                        <th className={`${commonThClasses} text-center w-16`}>Pos</th>
                        <th className={`${commonThClasses} text-center w-16`}>Grade</th>
                        <th className={commonThClasses}>Remark</th>
                    </tr>
                </thead>
           )
       }
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
        <div className="p-6 md:p-8 border-b border-gray-200" style={layout === 'pastel' ? { backgroundColor: themeColor + '10' } : {}}>
            <div className="flex flex-col md:flex-row items-center gap-6">
                {logoUrl ? (
                    <img src={logoUrl} alt="School Logo" className="w-24 h-24 object-contain" />
                ) : (
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
                        <ShieldIcon className="w-12 h-12 text-slate-400" />
                    </div>
                )}
                
                <div className="text-center md:text-left flex-grow">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 uppercase tracking-wide">{schoolName}</h1>
                    <p className="text-slate-600 mt-1 italic">{reportDetails.schoolConfig.motto}</p>
                    <p className="text-sm text-slate-500 mt-1">{reportDetails.schoolConfig.address}</p>
                    <div className={`mt-3 inline-block px-4 py-1 rounded-full font-semibold border ${layout === 'pastel' ? 'border-transparent' : 'border-slate-200'}`} style={layout === 'pastel' ? { backgroundColor: themeColor, color: 'white' } : { backgroundColor: '#f1f5f9', color: '#1e293b' }}>
                        {term.sessionLabel} ACADEMIC SESSION - {term.termLabel.toUpperCase()}
                    </div>
                </div>

                {showPhoto && (
                    <div className="w-24 h-32 bg-slate-100 border border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        [PHOTO]
                    </div>
                )}
            </div>
        </div>
  );

  const StudentInfoGrid = () => (
      <div className="bg-slate-50 p-4 border-b border-gray-200 text-sm" style={layout === 'pastel' ? { backgroundColor: 'white' } : {}}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4">
            <div><span className="text-slate-500 font-semibold">Name:</span> <span className="font-bold block md:inline md:ml-1">{student.fullName}</span></div>
            <div><span className="text-slate-500 font-semibold">Class:</span> <span className="font-bold block md:inline md:ml-1">{student.className}</span></div>
            <div><span className="text-slate-500 font-semibold">Admission No:</span> <span className="font-bold block md:inline md:ml-1">{'N/A'}</span></div>
            <div><span className="text-slate-500 font-semibold">Attendance:</span> <span className="font-bold block md:inline md:ml-1">{attendance.present} / {attendance.possible}</span></div>
        </div>
    </div>
  );

  const SummaryCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
        <div className={`p-3 rounded-lg border text-center ${layout === 'pastel' ? 'bg-blue-50 border-blue-100' : 'bg-blue-50 border-blue-100'}`}>
            <p className="text-xs text-blue-600 uppercase font-bold">Total Score</p>
            <p className="text-xl font-bold text-slate-800">{summary.average * subjects.length}</p>
        </div>
        <div className={`p-3 rounded-lg border text-center ${layout === 'pastel' ? 'bg-purple-50 border-purple-100' : 'bg-purple-50 border-purple-100'}`}>
            <p className="text-xs text-purple-600 uppercase font-bold">Average</p>
            <p className="text-xl font-bold text-slate-800">{Number(summary.average).toFixed(2)}%</p>
        </div>
            <div className={`p-3 rounded-lg border text-center ${layout === 'pastel' ? 'bg-green-50 border-green-100' : 'bg-green-50 border-green-100'}`}>
            <p className="text-xs text-green-600 uppercase font-bold">GPA</p>
            <p className="text-xl font-bold text-slate-800">{summary.gpaAverage ? Number(summary.gpaAverage).toFixed(2) : 'N/A'}</p>
        </div>
        {showPosition && (
            <>
            <div className={`p-3 rounded-lg border text-center ${layout === 'pastel' ? 'bg-amber-50 border-amber-100' : 'bg-amber-50 border-amber-100'}`}>
                <p className="text-xs text-amber-600 uppercase font-bold">Pos. (Arm)</p>
                <p className="text-xl font-bold text-slate-800">{summary.positionInArm ? getOrdinal(summary.positionInArm) : 'N/A'}</p>
            </div>
            {summary.positionInGradeLevel && (
                <div className={`p-3 rounded-lg border text-center ${layout === 'pastel' ? 'bg-orange-50 border-orange-100' : 'bg-orange-50 border-orange-100'}`}>
                    <p className="text-xs text-orange-600 uppercase font-bold">Pos. (Grade)</p>
                    <p className="text-xl font-bold text-slate-800">{getOrdinal(summary.positionInGradeLevel)}</p>
                </div>
            )}
            </>
        )}
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


  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:bg-white print:p-0 font-sans">
      
      {/* Dynamic Print Style Injection */}
      <style>
        {`
          @media print {
            @page {
              size: ${orientation};
              margin: 0.5cm;
            }
            body {
                background: white;
            }
            .printable-report {
                width: 100% !important;
                max-width: none !important;
                border: none !important;
                box-shadow: none !important;
                margin: 0 !important;
            }
          }
        `}
      </style>

      <div className={`mx-auto print:w-full print:max-w-none ${orientation === 'landscape' ? 'max-w-[1100px]' : 'max-w-4xl'}`}>
        
        <div className="mb-4 flex justify-between items-center no-print">
          <button onClick={onBack} className="px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 text-slate-700 font-medium">
            &larr; Back
          </button>
          <div className="flex gap-2">
            {!isPublished && <span className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-bold border border-yellow-300">Unpublished Preview</span>}
            <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 font-medium">
                Print Report
            </button>
          </div>
        </div>

        <div className={`bg-white shadow-2xl print:shadow-none rounded-xl overflow-hidden printable-report ${layout === 'professional' ? 'border-4 border-double border-black' : 'border-t-8'}`} style={layout !== 'professional' ? containerStyle : {}}>
            
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
                    <div className="px-6 pb-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-3 border-b pb-1" style={{ borderColor: themeColor }}>Academic Performance</h3>
                        <table className={commonTableClasses}>
                            {renderTableHeader()}
                            {renderTableBody()}
                        </table>
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
                        <div>Att: <strong>{attendance.present}/{attendance.possible}</strong></div>
                    </div>
                    
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
  );
};

export default StudentReportView;
