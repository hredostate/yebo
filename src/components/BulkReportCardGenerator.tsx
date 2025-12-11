import React, { useState, useEffect, useRef } from 'react';
import { supa as supabase } from '../offline/client';
import type { Student, GradingScheme, SchoolConfig } from '../types';
import Spinner from './common/Spinner';
import { CloseIcon, DownloadIcon, CheckCircleIcon, AlertCircleIcon } from './common/icons';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';

interface BulkReportCardGeneratorProps {
  classId: number;
  className: string;
  termId: number;
  termName: string;
  students: Student[];
  onClose: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  schoolConfig: SchoolConfig | null;
  gradingSchemes: GradingScheme[];
}

interface StudentWithDebt extends Student {
  hasDebt: boolean;
  outstandingAmount: number;
  averageScore?: number;
  reportExists: boolean;
}

interface ReportSubject {
  subjectName: string;
  totalScore?: number;
  grade?: string;
  remark?: string;
}

interface ReportData {
  student: {
    fullName: string;
    className: string;
  };
  term: {
    sessionLabel: string;
    termLabel: string;
  };
  subjects: ReportSubject[];
  schoolConfig: {
    school_name?: string;
    address?: string;
    motto?: string;
  };
  summary?: {
    positionInArm?: number | string;
    totalStudentsInArm?: number | string;
  };
  comments?: {
    teacher?: string;
    principal?: string;
  };
}

const BulkReportCardGenerator: React.FC<BulkReportCardGeneratorProps> = ({
  classId,
  className,
  termId,
  termName,
  students,
  onClose,
  addToast,
  schoolConfig,
  gradingSchemes,
}) => {
  const [studentsWithDebt, setStudentsWithDebt] = useState<StudentWithDebt[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Utility function to sanitize strings for safe HTML rendering and filenames
  const sanitizeString = (str: string): string => {
    return str
      .replace(/[<>'"&]/g, (char) => {
        // HTML entity encoding for basic XSS prevention
        const entities: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
          '&': '&amp;'
        };
        return entities[char] || char;
      })
      .replace(/[^\w\s.\-]/g, '_') // Allow periods and hyphens for filenames
      .trim();
  };

  useEffect(() => {
    fetchStudentData();
  }, [classId, termId, students]);

  const fetchStudentData = async () => {
    setIsLoading(true);
    try {
      // Get students in this class
      if (!supabase) {
        throw new Error('Database connection not available');
      }

      const { data: enrollments, error: enrollError } = await supabase
        .from('academic_class_students')
        .select('student_id')
        .eq('academic_class_id', classId);

      if (enrollError) throw enrollError;

      const enrolledStudentIds = enrollments?.map(e => e.student_id) || [];
      const classStudents = students.filter(s => enrolledStudentIds.includes(s.id));

      // Fetch invoices for these students in this term
      const { data: invoices, error: invoiceError } = await supabase
        .from('student_invoices')
        .select('student_id, total_amount, amount_paid, status')
        .eq('term_id', termId)
        .in('student_id', enrolledStudentIds);

      if (invoiceError) throw invoiceError;

      // Fetch student term reports to get average scores
      const { data: reports, error: reportError } = await supabase
        .from('student_term_reports')
        .select('student_id, average_score')
        .eq('term_id', termId)
        .in('student_id', enrolledStudentIds);

      if (reportError) throw reportError;

      // Calculate debt status for each student
      const studentsData: StudentWithDebt[] = classStudents.map(student => {
        const studentInvoices = invoices?.filter(inv => inv.student_id === student.id) || [];
        const totalOwed = studentInvoices.reduce((sum, inv) => sum + (inv.total_amount - inv.amount_paid), 0);
        const hasUnpaidInvoices = studentInvoices.some(inv => inv.status !== 'Paid');
        const hasDebt = totalOwed > 0 || hasUnpaidInvoices;

        const studentReport = reports?.find(r => r.student_id === student.id);
        
        return {
          ...student,
          hasDebt,
          outstandingAmount: totalOwed,
          averageScore: studentReport?.average_score,
          reportExists: !!studentReport,
        };
      });

      // Sort by name
      studentsData.sort((a, b) => a.name.localeCompare(b.name));

      setStudentsWithDebt(studentsData);

      // Auto-select students without debt and with reports
      const autoSelectIds = new Set(
        studentsData
          .filter(s => !s.hasDebt && s.reportExists)
          .map(s => s.id)
      );
      setSelectedStudentIds(autoSelectIds);

    } catch (error: any) {
      addToast(`Error loading student data: ${error.message}`, 'error');
      console.error('Error fetching student data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    const eligibleStudents = studentsWithDebt.filter(s => !s.hasDebt && s.reportExists);
    setSelectedStudentIds(new Set(eligibleStudents.map(s => s.id)));
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  const handleToggleStudent = (studentId: number) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };

  const generateStudentReportPDF = async (student: StudentWithDebt): Promise<Blob | null> => {
    try {
      // Fetch detailed report data for this student
      const { data: reportData, error: reportError } = await supabase.rpc('get_student_term_report_details', {
        p_student_id: student.id,
        p_term_id: termId,
      });

      if (reportError || !reportData) {
        console.error(`Error fetching report for student ${student.name}:`, reportError);
        addToast(`Failed to fetch report for ${student.name}`, 'error');
        return null;
      }

      // Create a temporary container for the report
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.width = '210mm'; // A4 width
      tempContainer.style.backgroundColor = 'white';
      tempContainer.style.padding = '20mm';
      document.body.appendChild(tempContainer);

      // Create simplified report HTML
      const reportHTML = createReportHTML(reportData, student);
      tempContainer.innerHTML = reportHTML;

      // Wait for any images to load
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate PDF using html2canvas and jsPDF
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Remove temporary container
      document.body.removeChild(tempContainer);

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);

      return pdf.output('blob');
    } catch (error) {
      console.error(`Error generating PDF for student ${student.name}:`, error);
      return null;
    }
  };

  const createReportHTML = (reportData: ReportData, student: StudentWithDebt): string => {
    const { student: studentData, term, subjects, schoolConfig: config } = reportData;
    const averageScore = subjects.reduce((sum, s) => sum + (s.totalScore || 0), 0) / subjects.length;

    // Sanitize all user-provided content
    const sanitizedSchoolName = sanitizeString(config.school_name || 'School');
    const sanitizedAddress = sanitizeString(config.address || '');
    const sanitizedMotto = sanitizeString(config.motto || '');
    const sanitizedStudentName = sanitizeString(studentData.fullName || student.name);
    const sanitizedClassName = sanitizeString(studentData.className || className);
    const sanitizedAdmNumber = sanitizeString(student.admission_number || 'N/A');
    const sanitizedSessionLabel = sanitizeString(term.sessionLabel || '');
    const sanitizedTermLabel = sanitizeString(term.termLabel || '');

    return `
      <div style="font-family: Arial, sans-serif; color: #000; padding: 20px;">
        <!-- Header -->
        <div style="text-center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: bold; margin: 0; text-transform: uppercase;">${sanitizedSchoolName}</h1>
          <p style="font-size: 12px; margin: 5px 0;">${sanitizedAddress}</p>
          <p style="font-size: 11px; font-style: italic; margin: 5px 0;">${sanitizedMotto}</p>
          <div style="margin-top: 10px; padding: 8px 20px; background: #2563eb; color: white; display: inline-block; border-radius: 5px;">
            <strong>${sanitizedSessionLabel} - ${sanitizedTermLabel}</strong>
          </div>
        </div>

        <!-- Student Info -->
        <div style="background: #f1f5f9; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
            <div><strong>Name:</strong> ${sanitizedStudentName}</div>
            <div><strong>Class:</strong> ${sanitizedClassName}</div>
            <div><strong>Admission No:</strong> ${sanitizedAdmNumber}</div>
            <div><strong>Term:</strong> ${sanitizedTermLabel}</div>
          </div>
        </div>

        <!-- Subjects Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
          <thead>
            <tr style="background: #2563eb; color: white;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Subject</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 80px;">Score</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 60px;">Grade</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Remark</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map((sub, index) => {
              const sanitizedSubjectName = sanitizeString(sub.subjectName);
              const sanitizedGrade = sanitizeString(sub.grade || '-');
              const sanitizedRemark = sanitizeString(sub.remark || '-');
              return `
              <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                <td style="border: 1px solid #ddd; padding: 8px;">${sanitizedSubjectName}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${sub.totalScore?.toFixed(1) || '0'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${sanitizedGrade}</td>
                <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; font-style: italic;">${sanitizedRemark}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>

        <!-- Summary -->
        <div style="background: #dbeafe; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center;">
            <div>
              <p style="font-size: 11px; color: #1e40af; margin: 0; font-weight: bold;">AVERAGE SCORE</p>
              <p style="font-size: 20px; font-weight: bold; margin: 5px 0;">${averageScore.toFixed(1)}%</p>
            </div>
            <div>
              <p style="font-size: 11px; color: #1e40af; margin: 0; font-weight: bold;">POSITION</p>
              <p style="font-size: 20px; font-weight: bold; margin: 5px 0;">${reportData.summary?.positionInArm || 'N/A'}</p>
            </div>
            <div>
              <p style="font-size: 11px; color: #1e40af; margin: 0; font-weight: bold;">NO. IN CLASS</p>
              <p style="font-size: 20px; font-weight: bold; margin: 5px 0;">${reportData.summary?.totalStudentsInArm || 'N/A'}</p>
            </div>
          </div>
        </div>

        <!-- Comments -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 20px;">
          <div style="border: 1px solid #ddd; padding: 12px; border-radius: 5px;">
            <strong style="font-size: 11px; display: block; margin-bottom: 5px; border-bottom: 1px solid #ddd; padding-bottom: 3px;">CLASS TEACHER'S REMARK:</strong>
            <p style="font-style: italic; font-size: 11px; margin: 0;">${sanitizeString(reportData.comments?.teacher || 'No comment provided.')}</p>
          </div>
          <div style="border: 1px solid #ddd; padding: 12px; border-radius: 5px;">
            <strong style="font-size: 11px; display: block; margin-bottom: 5px; border-bottom: 1px solid #ddd; padding-bottom: 3px;">PRINCIPAL'S REMARK:</strong>
            <p style="font-style: italic; font-size: 11px; margin: 0;">${sanitizeString(reportData.comments?.principal || 'No comment provided.')}</p>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #6b7280;">
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    `;
  };

  const handleGenerateZIP = async () => {
    if (selectedStudentIds.size === 0) {
      addToast('Please select at least one student.', 'error');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress({ current: 0, total: selectedStudentIds.size });

    try {
      const zip = new JSZip();
      const selectedStudents = studentsWithDebt.filter(s => selectedStudentIds.has(s.id));
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        setGenerationProgress({ current: i + 1, total: selectedStudents.length });

        try {
          const pdfBlob = await generateStudentReportPDF(student);
          
          if (pdfBlob) {
            // Create filename: StudentName_AdmNumber_Term_Report.pdf
            const safeName = sanitizeString(student.name);
            const admNumber = sanitizeString(student.admission_number || 'NO_ADM');
            const safeTermName = sanitizeString(termName);
            const filename = `${safeName}_${admNumber}_${safeTermName}_Report.pdf`;
            
            zip.file(filename, pdfBlob);
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Failed to generate PDF for ${student.name}:`, error);
          failCount++;
        }
      }

      if (successCount === 0) {
        addToast('Failed to generate any report cards.', 'error');
        return;
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Download ZIP
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      const safeClassName = sanitizeString(className);
      const safeTermName = sanitizeString(termName);
      link.download = `${safeClassName}_${safeTermName}_ReportCards.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast(
        `Successfully generated ${successCount} report card(s)${failCount > 0 ? `. ${failCount} failed.` : '.'}`,
        'success'
      );

      // Close modal after successful generation
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error: any) {
      addToast(`Error generating report cards: ${error.message}`, 'error');
      console.error('Error generating ZIP:', error);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  const filteredStudents = studentsWithDebt.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.admission_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const eligibleCount = studentsWithDebt.filter(s => !s.hasDebt && s.reportExists).length;
  const debtCount = studentsWithDebt.filter(s => s.hasDebt).length;
  const noReportCount = studentsWithDebt.filter(s => !s.reportExists).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Generate Report Cards</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {className} - {termName}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <CloseIcon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Stats Bar */}
        {!isLoading && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Total Students</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{studentsWithDebt.length}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-700">
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">Eligible</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{eligibleCount}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-700">
                <p className="text-xs text-red-700 dark:text-red-400 font-medium">Has Debt</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{debtCount}</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">No Report</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{noReportCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="flex flex-wrap gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Search by name or admission number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[200px] px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={handleSelectAll}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  Select All Eligible
                </button>
                <button
                  onClick={handleDeselectAll}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 font-medium"
                >
                  Deselect All
                </button>
              </div>

              {/* Student List */}
              <div className="space-y-2">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.has(student.id);
                  const isDisabled = student.hasDebt || !student.reportExists;

                  return (
                    <div
                      key={student.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg transition ${
                        isDisabled
                          ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-75'
                          : isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleStudent(student.id)}
                        disabled={isDisabled || isGenerating}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{student.name}</p>
                          {student.hasDebt && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 text-xs font-medium">
                              <AlertCircleIcon className="w-3 h-3" />
                              Outstanding Debt
                            </span>
                          )}
                          {!student.reportExists && !student.hasDebt && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-xs font-medium">
                              No Report
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-400 mt-1">
                          <span>Adm: {student.admission_number || 'N/A'}</span>
                          {student.averageScore !== undefined && (
                            <span>Avg: {student.averageScore.toFixed(1)}%</span>
                          )}
                          {student.hasDebt && (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              Debt: ₦{student.outstandingAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <CheckCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}

                {filteredStudents.length === 0 && (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    No students found matching your search.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {isGenerating && generationProgress && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
                <span>Generating report cards...</span>
                <span>
                  {generationProgress.current} of {generationProgress.total}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{
                    width: `${(generationProgress.current / generationProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {selectedStudentIds.size} student{selectedStudentIds.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="px-6 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateZIP}
                disabled={isGenerating || selectedStudentIds.size === 0}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Spinner size="sm" />
                    Generating...
                  </>
                ) : (
                  <>
                    <DownloadIcon className="w-5 h-5" />
                    Download as ZIP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden container for rendering reports */}
      <div ref={reportContainerRef} style={{ position: 'absolute', left: '-9999px' }} />
    </div>
  );
};

export default BulkReportCardGenerator;
