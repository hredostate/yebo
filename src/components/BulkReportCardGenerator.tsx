import React, { useState, useEffect, useRef } from 'react';
import { supa as supabase } from '../offline/client';
import type { Student, GradingScheme, SchoolConfig, ReportCardConfig } from '../types';
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
  componentScores?: Record<string, number>;
  subjectPosition?: number | null;
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
    display_name?: string;
    address?: string;
    motto?: string;
    logo_url?: string;
  };
  summary?: {
    positionInArm?: number | string;
    totalStudentsInArm?: number | string;
    gpaAverage?: number | string;
    campusPercentile?: number | null;
  };
  comments?: {
    teacher?: string;
    principal?: string;
  };
  attendance?: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    unexcused: number;
    total: number;
    rate: number;
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
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [outputMode, setOutputMode] = useState<'zip' | 'combined'>('zip');
  const [includeCoverSheet, setIncludeCoverSheet] = useState(true);
  const [includeCsvSummary, setIncludeCsvSummary] = useState(false);
  const [watermarkChoice, setWatermarkChoice] = useState<'NONE' | 'DRAFT' | 'FINAL'>('NONE');
  const [templateChoice, setTemplateChoice] = useState<'classic' | 'modern' | 'pastel' | 'professional'>('classic');
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<'idle' | 'queued' | 'generating' | 'packaging' | 'completed' | 'failed'>('idle');
  const [jobReport, setJobReport] = useState<{ successes: string[]; failures: { name: string; reason: string }[] }>({ successes: [], failures: [] });
  const [samplePreviewIds, setSamplePreviewIds] = useState<Set<number>>(new Set());
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

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

  const togglePreviewStudent = (studentId: number) => {
    const updated = new Set(samplePreviewIds);
    if (updated.has(studentId)) {
      updated.delete(studentId);
    } else {
      if (updated.size >= 3) {
        addToast('Preview is limited to 3 students at a time.', 'info');
        return;
      }
      updated.add(studentId);
    }
    setSamplePreviewIds(updated);
  };

  const handlePreviewSample = async () => {
    const targetId = samplePreviewIds.values().next().value || selectedStudentIds.values().next().value;
    const targetStudent = studentsWithDebt.find((s) => s.id === targetId) || studentsWithDebt[0];

    if (!targetStudent) {
      addToast('Select at least one student to preview.', 'error');
      return;
    }

    setPreviewing(true);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    const result = await generateStudentReportPDF(targetStudent, templateChoice, watermarkChoice === 'NONE' ? undefined : watermarkChoice);
    if (result) {
      const url = URL.createObjectURL(result.blob);
      setPreviewUrl(url);
      setWizardStep(2);
      addToast('Preview ready. Open the PDF to inspect margins and layout.', 'info');
    }
    setPreviewing(false);
  };

  const appendCanvasToPdf = (pdf: jsPDF, canvas: HTMLCanvasElement, startOnNewPage = false) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 6;
    const safeWidth = pageWidth - margin * 2;
    const safeHeight = pageHeight - margin * 2;

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = safeWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (startOnNewPage) {
      pdf.addPage('a4', 'portrait');
    }

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= safeHeight;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage('a4', 'portrait');
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= safeHeight;
    }

    return Math.max(1, Math.ceil(imgHeight / safeHeight));
  };

  const renderReportCanvas = async (student: StudentWithDebt, layoutOverride?: string, watermarkText?: string) => {
    try {
      const { data: reportData, error: reportError } = await supabase.rpc('get_student_term_report_details', {
        p_student_id: student.id,
        p_term_id: termId,
      });

      if (reportError || !reportData) {
        console.error(`Error fetching report for student ${student.name}:`, reportError);
        addToast(`Failed to fetch report for ${student.name}`, 'error');
        return null;
      }

      let classReportConfig = null;
      let assessmentComponents = null;

      const { data: enrollment } = await supabase
        .from('academic_class_students')
        .select('academic_class_id')
        .eq('student_id', student.id)
        .eq('enrolled_term_id', termId)
        .maybeSingle();

      if (enrollment?.academic_class_id) {
        const { data: classData } = await supabase
          .from('academic_classes')
          .select('report_config, assessment_structure_id')
          .eq('id', enrollment.academic_class_id)
          .maybeSingle();

        if (classData?.report_config) {
          classReportConfig = classData.report_config;
        }

        if (classData?.assessment_structure_id) {
          const { data: structure } = await supabase
            .from('assessment_structures')
            .select('components')
            .eq('id', classData.assessment_structure_id)
            .maybeSingle();

          if (structure?.components) {
            assessmentComponents = structure.components;
          }
        }
      }

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '210mm';
      tempContainer.style.minHeight = '297mm';
      tempContainer.style.padding = '6mm';
      tempContainer.style.boxSizing = 'border-box';
      tempContainer.style.backgroundColor = 'white';
      tempContainer.className = 'a4-print-page';
      document.body.appendChild(tempContainer);

      const reportHTML = createReportHTML(reportData, student, classReportConfig, assessmentComponents, {
        layoutOverride,
        watermarkText,
      });
      tempContainer.innerHTML = reportHTML;

      await new Promise(resolve => setTimeout(resolve, 120));

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123,
      });

      document.body.removeChild(tempContainer);
      return canvas;
    } catch (error) {
      console.error(`Error preparing canvas for ${student.name}:`, error);
      return null;
    }
  };

  const generateStudentReportPDF = async (student: StudentWithDebt, layoutOverride?: string, watermarkText?: string): Promise<{ blob: Blob; pagesAdded: number } | null> => {
    try {
      const canvas = await renderReportCanvas(student, layoutOverride, watermarkText);
      if (!canvas) return null;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pagesAdded = appendCanvasToPdf(pdf, canvas, false);
      return { blob: pdf.output('blob'), pagesAdded };
    } catch (error) {
      console.error(`Error generating PDF for student ${student.name}:`, error);
      return null;
    }
  };

  // Helper to format ordinal suffix (1st, 2nd, 3rd)
  const getOrdinal = (n: number | null | undefined): string => {
    if (!n) return '-';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Helper for grade colors
  const getGradeStyle = (grade: string): string => {
    if (grade === 'A' || grade === 'A1') return 'background: #dcfce7; color: #166534;';
    if (grade.startsWith('B')) return 'background: #dbeafe; color: #1e40af;';
    if (grade.startsWith('C')) return 'background: #fef3c7; color: #92400e;';
    if (grade.startsWith('D')) return 'background: #fed7aa; color: #c2410c;';
    return 'background: #fee2e2; color: #991b1b;';
  };

  // Helper for attendance status
  const getAttendanceStatus = (rate: number) => {
    if (rate >= 95) return { label: 'Excellent', color: '#16a34a', emoji: '🌟', bgColor: '#f0fdf4' };
    if (rate >= 85) return { label: 'Good', color: '#2563eb', emoji: '👍', bgColor: '#eff6ff' };
    if (rate >= 75) return { label: 'Satisfactory', color: '#ca8a04', emoji: '📊', bgColor: '#fefce8' };
    return { label: 'Needs Improvement', color: '#dc2626', emoji: '⚠️', bgColor: '#fef2f2' };
  };

  // Helper to add alpha transparency to hex color
  const DEFAULT_FALLBACK_COLOR = '#000000';
  
  const addAlphaToColor = (hexColor: string | null | undefined, alpha: number): string => {
    // Handle null/undefined input
    if (!hexColor || typeof hexColor !== 'string') {
      return DEFAULT_FALLBACK_COLOR;
    }
    
    // Ensure hex color starts with #
    const color = hexColor.startsWith('#') ? hexColor : `#${hexColor}`;
    
    // Convert 3-digit hex to 6-digit
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    
    // Validate hex color
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
      return color; // Return original if invalid
    }
    
    // Convert alpha (0-100) to hex (00-FF)
    const alphaHex = Math.round((alpha / 100) * 255).toString(16).padStart(2, '0');
    return `#${hex}${alphaHex}`;
  };

  const createReportHTML = (
    reportData: ReportData,
    student: StudentWithDebt,
    classReportConfig?: ReportCardConfig | null,
    assessmentComponents?: Array<{ name: string; max_score: number }> | null,
    options?: { layoutOverride?: string; watermarkText?: string }
  ): string => {
    const { student: studentData, term, subjects, schoolConfig: config, summary, comments, attendance } = reportData;
    
    // Extract configuration
    const layout = options?.layoutOverride || classReportConfig?.layout || 'classic';
    const themeColor = classReportConfig?.colorTheme || '#1e3a8a';
    const logoUrl = classReportConfig?.customLogoUrl || config.logo_url;
    const schoolName = classReportConfig?.schoolNameOverride || config.display_name || config.school_name || 'School';
    const principalTitle = classReportConfig?.principalLabel || 'Principal';
    const teacherTitle = classReportConfig?.teacherLabel || 'Class Teacher';
    
    // Calculate summary values
    const totalScore = subjects.reduce((sum, s) => sum + (s.totalScore || 0), 0);
    const averageScore = subjects.length > 0 ? totalScore / subjects.length : 0;
    const gpa = summary?.gpaAverage || 'N/A';
    const position = summary?.positionInArm || 'N/A';
    const campusPercentile = summary?.campusPercentile ?? null;
    const attendanceRate = attendance?.rate || 0;
    const attendancePresentTotal = `${attendance?.present || 0}/${attendance?.total || 0}`;
    const attendanceStatus = getAttendanceStatus(attendanceRate);
    
    // Sanitize all user-provided content
    const sanitizedSchoolName = sanitizeString(schoolName);
    const sanitizedAddress = sanitizeString(config.address || '');
    const sanitizedMotto = sanitizeString(config.motto || '');
    const sanitizedStudentName = sanitizeString(studentData.fullName || student.name);
    const sanitizedClassName = sanitizeString(studentData.className || className);
    const sanitizedAdmNumber = sanitizeString(student.admission_number || 'N/A');
    const sanitizedSessionLabel = sanitizeString(term.sessionLabel || '');
    const sanitizedTermLabel = sanitizeString(term.termLabel || '');

    // Layout-specific styles
    let headerBgColor = '#f1f5f9';
    let headerTextColor = '#334155';
    let fontFamily = 'Arial, sans-serif';
    let borderRadius = '8px';
    
    if (layout === 'modern') {
      headerBgColor = themeColor;
      headerTextColor = 'white';
      borderRadius = '12px';
    } else if (layout === 'pastel') {
      headerBgColor = addAlphaToColor(themeColor, 20);
      headerTextColor = 'black';
    } else if (layout === 'professional') {
      fontFamily = 'Georgia, serif';
      borderRadius = '0';
    }

    const watermarkLayer = options?.watermarkText && options.watermarkText !== 'NONE'
      ? `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 52px; font-weight: 800; color: rgba(0,0,0,0.05); transform: rotate(-25deg); pointer-events: none;">${options.watermarkText}</div>`
      : '';

    // Constant for default CA/Exam scores
    const DEFAULT_SCORES = { caScore: 0, examScore: 0 };

    // Helper function to categorize assessment components
    const categorizeComponentScore = (componentScores: Record<string, number>) => {
      let caScore = 0;
      let examScore = 0;
      
      Object.entries(componentScores).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase();
        // More robust exam detection - check for common exam keywords
        if (lowerKey.includes('exam') || lowerKey.includes('test') || lowerKey.includes('final')) {
          examScore += value;
        } else {
          caScore += value;
        }
      });
      
      return { caScore, examScore };
    };

    // Generate HTML based on layout
    let htmlContent = '';

    if (layout === 'classic' || layout === 'modern' || layout === 'pastel') {
      htmlContent = `
        <div class="a4-print-safe-area" style="font-family: ${fontFamily}; color: #000; background: white; position: relative;">
          ${watermarkLayer}
          <!-- Header Section -->
          <div class="print-section" style="padding: 24px; border-bottom: 2px solid #e2e8f0; text-align: center; ${layout === 'pastel' ? `background:${addAlphaToColor(themeColor, 10)};` : ''}">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="width: 96px; height: 96px; object-fit: contain; margin: 0 auto 16px;" />` : ''}
            <h1 style="font-size: 28px; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">${sanitizedSchoolName}</h1>
            <p style="font-style: italic; margin: 4px 0; color: #64748b;">${sanitizedMotto}</p>
            <p style="font-size: 12px; margin: 4px 0; color: #64748b;">${sanitizedAddress}</p>
            <div style="display: inline-block; margin-top: 16px; padding: 8px 24px; background: ${themeColor}; color: white; border-radius: 20px; font-weight: 600; font-size: 13px;">
              ${sanitizedSessionLabel} - ${sanitizedTermLabel}
            </div>
          </div>

          <!-- Student Info Grid -->
          <div style="background: #f8fafc; padding: 20px; border-bottom: 1px solid #e2e8f0;">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; font-size: 13px;">
              <div><span style="color: #64748b;">Name:</span> <strong>${sanitizedStudentName}</strong></div>
              <div><span style="color: #64748b;">Class:</span> <strong>${sanitizedClassName}</strong></div>
              <div><span style="color: #64748b;">Admission No:</span> <strong>${sanitizedAdmNumber}</strong></div>
              <div><span style="color: #64748b;">Attendance:</span> <strong>${attendanceRate.toFixed(1)}% (${attendancePresentTotal})</strong></div>
            </div>
          </div>

          <!-- Summary Cards -->
          <div class="print-section" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 24px;">
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: ${borderRadius}; padding: 16px; text-align: center;">
              <p style="font-size: 10px; color: #2563eb; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">TOTAL SCORE</p>
              <p style="font-size: 24px; font-weight: bold; margin: 0; color: #1e293b;">${totalScore.toFixed(1)}</p>
            </div>
            <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: ${borderRadius}; padding: 16px; text-align: center;">
              <p style="font-size: 10px; color: #9333ea; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">AVERAGE</p>
              <p style="font-size: 24px; font-weight: bold; margin: 0; color: #1e293b;">${averageScore.toFixed(2)}%</p>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: ${borderRadius}; padding: 16px; text-align: center;">
              <p style="font-size: 10px; color: #16a34a; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">GPA</p>
              <p style="font-size: 24px; font-weight: bold; margin: 0; color: #1e293b;">${gpa}</p>
            </div>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: ${borderRadius}; padding: 16px; text-align: center;">
              <p style="font-size: 10px; color: #d97706; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">POSITION</p>
              <p style="font-size: 24px; font-weight: bold; margin: 0; color: #1e293b;">${getOrdinal(typeof position === 'number' ? position : null)}</p>
              ${campusPercentile != null ? `<p style="margin:4px 0 0 0; font-size: 12px; color: #b45309;">Campus Percentile: ${campusPercentile.toFixed ? campusPercentile.toFixed(0) : campusPercentile}th</p>` : ''}
            </div>
          </div>

          <!-- Attendance Summary -->
          ${attendance && attendance.total > 0 ? `
          <div class="print-section" style="border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 20px; margin: 0 24px 24px 24px;">
            <h4 style="text-align: center; font-weight: bold; color: #475569; text-transform: uppercase; font-size: 11px; margin: 0 0 16px 0; letter-spacing: 0.5px;">ATTENDANCE SUMMARY</h4>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 16px;">
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 12px; text-align: center;">
                <p style="font-size: 9px; color: #64748b; margin: 0 0 4px 0; text-transform: uppercase;">Days Present</p>
                <p style="font-size: 20px; font-weight: bold; color: #16a34a; margin: 0;">${attendance.present}</p>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 12px; text-align: center;">
                <p style="font-size: 9px; color: #64748b; margin: 0 0 4px 0; text-transform: uppercase;">Days Absent</p>
                <p style="font-size: 20px; font-weight: bold; color: #dc2626; margin: 0;">${attendance.absent}</p>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 12px; text-align: center;">
                <p style="font-size: 9px; color: #64748b; margin: 0 0 4px 0; text-transform: uppercase;">Days Late</p>
                <p style="font-size: 20px; font-weight: bold; color: #ea580c; margin: 0;">${attendance.late}</p>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 12px; text-align: center;">
                <p style="font-size: 9px; color: #64748b; margin: 0 0 4px 0; text-transform: uppercase;">Excused</p>
                <p style="font-size: 20px; font-weight: bold; color: #2563eb; margin: 0;">${attendance.excused}</p>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 12px; text-align: center;">
                <p style="font-size: 9px; color: #64748b; margin: 0 0 4px 0; text-transform: uppercase;">Unexcused</p>
                <p style="font-size: 20px; font-weight: bold; color: #b91c1c; margin: 0;">${attendance.unexcused}</p>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 12px; text-align: center;">
                <p style="font-size: 9px; color: #64748b; margin: 0 0 4px 0; text-transform: uppercase;">Total Days</p>
                <p style="font-size: 20px; font-weight: bold; color: #475569; margin: 0;">${attendance.total}</p>
              </div>
            </div>
            <div style="border: 2px solid #e2e8f0; border-radius: ${borderRadius}; padding: 16px; background: ${attendanceStatus.bgColor};">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px;">
                <span style="font-weight: 600; color: #475569;">Overall Attendance Rate</span>
                <span style="font-weight: bold; color: ${attendanceStatus.color};">${attendanceRate.toFixed(1)}%</span>
              </div>
              <div style="width: 100%; height: 16px; background: #e2e8f0; border-radius: 9999px; overflow: hidden;">
                <div style="height: 100%; width: ${Math.min(attendanceRate, 100)}%; background: ${attendanceStatus.color};"></div>
              </div>
              <p style="text-align: center; font-weight: 600; color: ${attendanceStatus.color}; margin: 8px 0 0 0; font-size: 13px;">
                ${attendanceStatus.emoji} ${attendanceStatus.label}
              </p>
            </div>
          </div>
          ` : ''}

          <!-- Subjects Table -->
          <div class="print-section" style="padding: 0 24px 24px 24px;">
            <h3 style="font-size: 16px; font-weight: bold; color: #1e293b; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid ${themeColor};">Academic Performance</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background: ${headerBgColor}; color: ${headerTextColor};">
                  <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; width: 32px; font-weight: bold;">S/N</th>
                  <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: bold;">Subject</th>
                  ${assessmentComponents && assessmentComponents.length > 0 ? 
                    assessmentComponents.map(comp => `
                      <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; width: 60px; font-weight: bold;">
                        ${sanitizeString(comp.name)}<br/><span style="font-size: 9px; font-weight: normal;">/${comp.max_score}</span>
                      </th>
                    `).join('') : `
                      <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; width: 60px; font-weight: bold;">CA</th>
                      <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; width: 60px; font-weight: bold;">Exam</th>
                  `}
                  <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; width: 60px; font-weight: bold;">Total</th>
                  <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; width: 50px; font-weight: bold;">Grade</th>
                  <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; width: 50px; font-weight: bold;">Pos</th>
                  <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: bold;">Remark</th>
                </tr>
              </thead>
              <tbody>
                ${subjects.map((sub, idx) => {
                  const sanitizedSubjectName = sanitizeString(sub.subjectName);
                  const sanitizedGrade = sanitizeString(sub.grade || '-');
                  const sanitizedRemark = sanitizeString(sub.remark || '-');
                  
                  // Calculate CA and Exam scores from componentScores using helper
                  const { caScore, examScore } = sub.componentScores 
                    ? categorizeComponentScore(sub.componentScores)
                    : DEFAULT_SCORES;
                  
                  return `
                  <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">${sanitizedSubjectName}</td>
                    ${assessmentComponents && assessmentComponents.length > 0 ? 
                      assessmentComponents.map(comp => `
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${sub.componentScores?.[comp.name] ?? '-'}</td>
                      `).join('') : `
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${sub.componentScores ? caScore : '-'}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${sub.componentScores ? examScore : '-'}</td>
                    `}
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${sub.totalScore?.toFixed(1) || '0'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">
                      <span style="padding: 4px 8px; border-radius: 4px; font-weight: bold; ${getGradeStyle(sanitizedGrade)}">${sanitizedGrade}</span>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-size: 10px; color: #64748b;">${getOrdinal(sub.subjectPosition)}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; font-style: italic; font-size: 10px;">${sanitizedRemark}</td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>
          </div>

          <!-- Signatories Section -->
          <div class="print-section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 0 24px 24px 24px;">
            <div style="border: 1px solid #cbd5e1; border-radius: ${borderRadius}; padding: 16px;">
              <h4 style="font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 0 0 12px 0; font-size: 12px;">${sanitizeString(teacherTitle)}'s Remark</h4>
              <p style="font-style: italic; color: #475569; min-height: 48px; margin: 0; font-size: 11px;">${sanitizeString(comments?.teacher || 'No comment provided.')}</p>
              <div style="margin-top: 16px; padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">SIGNATURE & DATE</span>
              </div>
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: ${borderRadius}; padding: 16px;">
              <h4 style="font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 0 0 12px 0; font-size: 12px;">${sanitizeString(principalTitle)}'s Remark</h4>
              <p style="font-style: italic; color: #475569; min-height: 48px; margin: 0; font-size: 11px;">${sanitizeString(comments?.principal || 'No comment provided.')}</p>
              <div style="margin-top: 16px; padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">SIGNATURE & DATE</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: ${layout === 'pastel' ? themeColor : '#1e293b'}; color: white; text-align: center; padding: 12px; font-size: 10px;">
            ${sanitizedSchoolName} • Generated on ${new Date().toLocaleDateString()}
          </div>
        </div>
      `;
    } else if (layout === 'compact') {
      htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #000; background: white; padding: 24px;">
          <!-- Compact Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 16px;">
            <div style="display: flex; gap: 16px; align-items: center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="width: 64px; height: 64px; object-fit: contain;" />` : ''}
              <div>
                <h1 style="font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase;">${sanitizedSchoolName}</h1>
                <p style="font-size: 10px; color: #666; margin: 2px 0;">${sanitizedAddress}</p>
              </div>
            </div>
            <div style="text-align: right;">
              <h2 style="font-size: 16px; font-weight: bold; margin: 0; text-transform: uppercase;">${sanitizedTermLabel} Report</h2>
              <p style="font-size: 11px; margin: 2px 0;">${sanitizedSessionLabel}</p>
            </div>
          </div>

          <!-- Compact Student Info -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; font-size: 11px; border: 1px solid #ddd; padding: 12px;">
            <div>Name: <strong>${sanitizedStudentName}</strong></div>
            <div>Class: <strong>${sanitizedClassName}</strong></div>
            <div>Avg: <strong>${averageScore.toFixed(2)}%</strong></div>
            <div>Pos: <strong>${getOrdinal(typeof position === 'number' ? position : null)}</strong></div>
            <div>Adm: <strong>${sanitizedAdmNumber}</strong></div>
            <div>Att: <strong>${attendanceRate.toFixed(1)}% (${attendancePresentTotal})</strong></div>
          </div>

          ${attendance && attendance.total > 0 ? `
          <!-- Compact Attendance -->
          <div style="border: 1px solid #ddd; padding: 12px; margin-bottom: 16px;">
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; font-size: 10px; text-align: center;">
              <div><div style="font-weight: bold; color: #16a34a;">${attendance.present}</div><div style="color: #666;">Present</div></div>
              <div><div style="font-weight: bold; color: #dc2626;">${attendance.absent}</div><div style="color: #666;">Absent</div></div>
              <div><div style="font-weight: bold; color: #ea580c;">${attendance.late}</div><div style="color: #666;">Late</div></div>
              <div><div style="font-weight: bold; color: #2563eb;">${attendance.excused}</div><div style="color: #666;">Excused</div></div>
              <div><div style="font-weight: bold; color: #b91c1c;">${attendance.unexcused}</div><div style="color: #666;">Unexcused</div></div>
              <div><div style="font-weight: bold; color: #475569;">${attendance.total}</div><div style="color: #666;">Total</div></div>
            </div>
          </div>
          ` : ''}

          <!-- Compact Subjects Table -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 10px; margin-bottom: 16px;">
            <thead>
              <tr style="background: #000; color: white;">
                <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 24px;">S/N</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: left;">Subject</th>
                ${assessmentComponents && assessmentComponents.length > 0 ? 
                  assessmentComponents.map(comp => `
                    <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 40px;">${sanitizeString(comp.name)}<br/><span style="font-size: 8px;">/${comp.max_score}</span></th>
                  `).join('') : `
                    <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 40px;">CA</th>
                    <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 40px;">Exam</th>
                `}
                <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 40px;">Total</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 40px;">Grade</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 40px;">Pos</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: left;">Remark</th>
              </tr>
            </thead>
            <tbody>
              ${subjects.map((sub, idx) => {
                const sanitizedSubjectName = sanitizeString(sub.subjectName);
                const sanitizedGrade = sanitizeString(sub.grade || '-');
                const sanitizedRemark = sanitizeString(sub.remark || '-');
                
                // Calculate CA and Exam scores from componentScores using helper
                const { caScore, examScore } = sub.componentScores 
                  ? categorizeComponentScore(sub.componentScores)
                  : DEFAULT_SCORES;
                
                return `
                <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f5f5f5'};">
                  <td style="border: 1px solid #000; padding: 4px; text-align: center;">${idx + 1}</td>
                  <td style="border: 1px solid #000; padding: 4px;">${sanitizedSubjectName}</td>
                  ${assessmentComponents && assessmentComponents.length > 0 ? 
                    assessmentComponents.map(comp => `
                      <td style="border: 1px solid #000; padding: 4px; text-align: center;">${sub.componentScores?.[comp.name] ?? '-'}</td>
                    `).join('') : `
                      <td style="border: 1px solid #000; padding: 4px; text-align: center;">${sub.componentScores ? caScore : '-'}</td>
                      <td style="border: 1px solid #000; padding: 4px; text-align: center;">${sub.componentScores ? examScore : '-'}</td>
                  `}
                  <td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold;">${sub.totalScore?.toFixed(1) || '0'}</td>
                  <td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold;">${sanitizedGrade}</td>
                  <td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 9px;">${getOrdinal(sub.subjectPosition)}</td>
                  <td style="border: 1px solid #000; padding: 4px; font-style: italic; font-size: 9px;">${sanitizedRemark}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>

          <!-- Compact Comments -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 10px;">
            <div style="border: 1px solid #000; padding: 8px;">
              <strong style="display: block; border-bottom: 1px solid #000; margin-bottom: 4px; padding-bottom: 2px;">${sanitizeString(teacherTitle)}:</strong>
              <p style="font-style: italic; margin: 0;">${sanitizeString(comments?.teacher || 'No comment provided.')}</p>
            </div>
            <div style="border: 1px solid #000; padding: 8px;">
              <strong style="display: block; border-bottom: 1px solid #000; margin-bottom: 4px; padding-bottom: 2px;">${sanitizeString(principalTitle)}:</strong>
              <p style="font-style: italic; margin: 0;">${sanitizeString(comments?.principal || 'No comment provided.')}</p>
            </div>
          </div>
        </div>
      `;
    } else if (layout === 'professional') {
      htmlContent = `
        <div style="font-family: Georgia, serif; color: #000; background: white; padding: 32px; border: 4px double #000;">
          <!-- Professional Header -->
          <div style="text-align: center; margin-bottom: 32px; border-bottom: 2px solid #000; padding-bottom: 24px;">
            <h1 style="font-size: 32px; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 2px;">${sanitizedSchoolName}</h1>
            <p style="font-size: 12px; margin: 4px 0; text-transform: uppercase; letter-spacing: 1px;">${sanitizedAddress}</p>
            <div style="margin-top: 16px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 8px 0;">
              <h2 style="font-size: 20px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Student Performance Report</h2>
            </div>
          </div>

          <!-- Professional Student Info -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            <div>
              <p style="margin: 4px 0;"><span style="font-weight: bold; display: inline-block; width: 140px;">Student Name:</span> ${sanitizedStudentName}</p>
              <p style="margin: 4px 0;"><span style="font-weight: bold; display: inline-block; width: 140px;">Class:</span> ${sanitizedClassName}</p>
              <p style="margin: 4px 0;"><span style="font-weight: bold; display: inline-block; width: 140px;">Admission No:</span> ${sanitizedAdmNumber}</p>
            </div>
            <div>
              <p style="margin: 4px 0;"><span style="font-weight: bold; display: inline-block; width: 140px;">Session:</span> ${sanitizedSessionLabel}</p>
              <p style="margin: 4px 0;"><span style="font-weight: bold; display: inline-block; width: 140px;">Term:</span> ${sanitizedTermLabel}</p>
              <p style="margin: 4px 0;"><span style="font-weight: bold; display: inline-block; width: 140px;">Date:</span> ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          ${attendance && attendance.total > 0 ? `
          <!-- Professional Attendance -->
          <div style="border: 1px solid #000; padding: 16px; margin-bottom: 24px;">
            <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 0 0 12px 0;">Attendance Summary</p>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; font-size: 11px; text-align: center;">
              <div><div style="font-weight: bold; color: #000;">${attendance.present}</div><div style="color: #666;">Present</div></div>
              <div><div style="font-weight: bold; color: #000;">${attendance.absent}</div><div style="color: #666;">Absent</div></div>
              <div><div style="font-weight: bold; color: #000;">${attendance.late}</div><div style="color: #666;">Late</div></div>
              <div><div style="font-weight: bold; color: #000;">${attendance.excused}</div><div style="color: #666;">Excused</div></div>
              <div><div style="font-weight: bold; color: #000;">${attendance.unexcused}</div><div style="color: #666;">Unexcused</div></div>
              <div><div style="font-weight: bold; color: #000;">${attendance.total}</div><div style="color: #666;">Total</div></div>
            </div>
          </div>
          ` : ''}

          <!-- Professional Subjects Table -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px; margin-bottom: 24px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 32px; font-weight: bold;">S/N</th>
                <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">Subject</th>
                ${assessmentComponents && assessmentComponents.length > 0 ? 
                  assessmentComponents.map(comp => `
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 50px; font-weight: bold;">${sanitizeString(comp.name)}<br/><span style="font-size: 9px; font-weight: normal;">/${comp.max_score}</span></th>
                  `).join('') : `
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 50px; font-weight: bold;">CA</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 50px; font-weight: bold;">Exam</th>
                `}
                <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 50px; font-weight: bold;">Total</th>
                <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 45px; font-weight: bold;">Grade</th>
                <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 45px; font-weight: bold;">Pos</th>
                <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">Remark</th>
              </tr>
            </thead>
            <tbody>
              ${subjects.map((sub, idx) => {
                const sanitizedSubjectName = sanitizeString(sub.subjectName);
                const sanitizedGrade = sanitizeString(sub.grade || '-');
                const sanitizedRemark = sanitizeString(sub.remark || '-');
                
                // Calculate CA and Exam scores from componentScores using helper
                const { caScore, examScore } = sub.componentScores 
                  ? categorizeComponentScore(sub.componentScores)
                  : DEFAULT_SCORES;
                
                return `
                <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fafafa'};">
                  <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
                  <td style="border: 1px solid #000; padding: 6px;">${sanitizedSubjectName}</td>
                  ${assessmentComponents && assessmentComponents.length > 0 ? 
                    assessmentComponents.map(comp => `
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${sub.componentScores?.[comp.name] ?? '-'}</td>
                    `).join('') : `
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${sub.componentScores ? caScore : '-'}</td>
                      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${sub.componentScores ? examScore : '-'}</td>
                  `}
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${sub.totalScore?.toFixed(1) || '0'}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${sanitizedGrade}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 10px;">${getOrdinal(sub.subjectPosition)}</td>
                  <td style="border: 1px solid #000; padding: 6px; font-style: italic; font-size: 10px;">${sanitizedRemark}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>

          <!-- Professional Summary -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: center; border: 1px solid #000; padding: 16px; background: #f5f5f5; margin-bottom: 24px;">
            <div>
              <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 0 0 4px 0;">Total</p>
              <p style="font-size: 18px; font-weight: bold; margin: 0;">${totalScore.toFixed(1)}</p>
            </div>
            <div>
              <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 0 0 4px 0;">Average</p>
              <p style="font-size: 18px; font-weight: bold; margin: 0;">${averageScore.toFixed(2)}%</p>
            </div>
            <div>
              <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 0 0 4px 0;">Position</p>
              <p style="font-size: 18px; font-weight: bold; margin: 0;">${getOrdinal(typeof position === 'number' ? position : null)}</p>
            </div>
            <div>
              <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 0 0 4px 0;">GPA</p>
              <p style="font-size: 18px; font-weight: bold; margin: 0;">${gpa}</p>
            </div>
          </div>

          <!-- Professional Comments -->
          <div style="margin-bottom: 32px;">
            <div style="margin-bottom: 16px;">
              <p style="font-weight: bold; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #000; margin: 0 0 8px 0; padding-bottom: 4px; letter-spacing: 0.5px;">${sanitizeString(teacherTitle)}'s Remarks</p>
              <p style="font-style: italic; font-size: 11px; margin: 0;">${sanitizeString(comments?.teacher || 'No comment provided.')}</p>
            </div>
            <div>
              <p style="font-weight: bold; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #000; margin: 0 0 8px 0; padding-bottom: 4px; letter-spacing: 0.5px;">${sanitizeString(principalTitle)}'s Remarks</p>
              <p style="font-style: italic; font-size: 11px; margin: 0;">${sanitizeString(comments?.principal || 'No comment provided.')}</p>
            </div>
          </div>

          <!-- Professional Footer -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 48px;">
            <div style="text-align: center;">
              <div style="width: 200px; border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
              <p style="font-size: 10px; text-transform: uppercase; margin: 0;">${sanitizeString(principalTitle)}</p>
            </div>
            <div style="font-size: 10px; text-align: right;">
              <p style="margin: 0;">Officially Generated Document</p>
            </div>
          </div>
        </div>
      `;
    }

    return htmlContent;
  };

  const buildCsvSummary = (studentsToSummarize: StudentWithDebt[]) => {
    const header = ['Student Name', 'Admission No', 'Average Score', 'Has Debt', 'Report Exists'];
    const rows = studentsToSummarize.map((s) => [
      `"${sanitizeString(s.name)}"`,
      `"${sanitizeString(s.admission_number || 'N/A')}"`,
      s.averageScore !== undefined ? s.averageScore.toFixed(2) : '',
      s.hasDebt ? 'YES' : 'NO',
      s.reportExists ? 'YES' : 'NO',
    ]);

    return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  };

  const addCoverSheet = (pdf: jsPDF, totalStudents: number) => {
    const margin = 14;
    pdf.setFontSize(20);
    pdf.text('Class Report Pack', margin, 28);
    pdf.setFontSize(14);
    pdf.text(`${className} • ${termName}`, margin, 40);
    pdf.setFontSize(11);
    pdf.text(`Total students queued: ${totalStudents}`, margin, 52);
    pdf.text(`Watermark: ${watermarkChoice === 'NONE' ? 'None' : watermarkChoice}`, margin, 60);
    pdf.text(`Template: ${templateChoice}`, margin, 68);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 76);
  };

  const handleGenerateReports = async () => {
    if (selectedStudentIds.size === 0) {
      addToast('Please select at least one student.', 'error');
      return;
    }

    const selectedStudents = studentsWithDebt.filter((s) => selectedStudentIds.has(s.id));
    setIsGenerating(true);
    setWizardStep(3);
    setJobStatus('queued');
    setJobReport({ successes: [], failures: [] });
    setGenerationProgress({ current: 0, total: selectedStudents.length });

    const zip = new JSZip();
    const combinedPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let combinedStarted = false;
    let successCount = 0;
    let failCount = 0;
    const successes: string[] = [];
    const failures: { name: string; reason: string }[] = [];
    const watermarkValue = watermarkChoice === 'NONE' ? undefined : watermarkChoice;

    try {
      if (outputMode === 'combined' && includeCoverSheet) {
        addCoverSheet(combinedPdf, selectedStudents.length);
        combinedStarted = true;
      }

      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        setJobStatus('generating');
        setGenerationProgress({ current: i + 1, total: selectedStudents.length });

        const canvas = await renderReportCanvas(student, templateChoice, watermarkValue);
        if (!canvas) {
          failCount++;
          failures.push({ name: student.name, reason: 'Render failed' });
          continue;
        }

        try {
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          appendCanvasToPdf(pdf, canvas, false);
          const pdfBlob = pdf.output('blob');

          const safeName = sanitizeString(student.name);
          const admNumber = sanitizeString(student.admission_number || 'NO_ADM');
          const safeTermName = sanitizeString(termName);
          const filename = `${safeName}_${admNumber}_${safeTermName}_Report.pdf`;

          if (outputMode === 'zip') {
            zip.file(filename, pdfBlob);
          } else {
            appendCanvasToPdf(combinedPdf, canvas, combinedStarted);
            combinedStarted = true;
          }

          successCount++;
          successes.push(student.name);
        } catch (err: any) {
          console.error(`Failed to generate PDF for ${student.name}:`, err);
          failCount++;
          failures.push({ name: student.name, reason: err?.message || 'Unknown error' });
        }
      }

      if (successCount === 0) {
        addToast('Failed to generate any report cards.', 'error');
        setJobStatus('failed');
        return;
      }

      setJobStatus('packaging');
      const safeClassName = sanitizeString(className);
      const safeTermName = sanitizeString(termName);
      const filenameBase = `${safeClassName}_${safeTermName}_ReportCards`;

      if (outputMode === 'zip') {
        if (includeCsvSummary) {
          zip.file(`${filenameBase}_summary.csv`, buildCsvSummary(selectedStudents));
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filenameBase}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const pdfBlob = combinedPdf.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filenameBase}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (includeCsvSummary) {
          const csvBlob = new Blob([buildCsvSummary(selectedStudents)], { type: 'text/csv' });
          const csvUrl = URL.createObjectURL(csvBlob);
          const csvLink = document.createElement('a');
          csvLink.href = csvUrl;
          csvLink.download = `${filenameBase}_summary.csv`;
          document.body.appendChild(csvLink);
          csvLink.click();
          document.body.removeChild(csvLink);
          URL.revokeObjectURL(csvUrl);
        }
      }

      setJobStatus('completed');
      setJobReport({ successes, failures });
      addToast(
        `Successfully generated ${successCount} report card(s)${failCount > 0 ? `. ${failCount} failed.` : '.'}`,
        'success'
      );
    } catch (error: any) {
      addToast(`Error generating report cards: ${error.message}`, 'error');
      console.error('Error generating reports:', error);
      setJobStatus('failed');
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
              {/* Wizard steps and options */}
              <div className="grid lg:grid-cols-3 gap-4 mb-6">
                <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs uppercase text-slate-500 tracking-[0.16em]">Generation Wizard</p>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Result Manager → Generate Report Cards</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {['Select & Options', 'Preview', 'Generate'].map((label, idx) => {
                        const stepNumber = (idx + 1) as 1 | 2 | 3;
                        const isActive = wizardStep === stepNumber;
                        const isComplete = wizardStep > stepNumber || jobStatus === 'completed';
                        return (
                          <div
                            key={label}
                            className={`flex items-center gap-1 px-3 py-1 rounded-full border ${isActive ? 'border-blue-500 bg-blue-50 text-blue-700' : isComplete ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600'}`}
                          >
                            <span className="font-semibold text-xs">{stepNumber}</span>
                            <span className="text-xs font-medium">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Output package</label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input type="radio" checked={outputMode === 'zip'} onChange={() => setOutputMode('zip')} className="w-4 h-4 text-blue-600" />
                          ZIP of individual PDFs
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input type="radio" checked={outputMode === 'combined'} onChange={() => setOutputMode('combined')} className="w-4 h-4 text-blue-600" />
                          Single combined PDF
                        </label>
                      </div>

                      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Template & watermark</label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={templateChoice}
                          onChange={(e) => setTemplateChoice(e.target.value as any)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        >
                          <option value="classic">Classic (balanced)</option>
                          <option value="modern">Modern gradient</option>
                          <option value="pastel">Pastel</option>
                          <option value="professional">Professional</option>
                        </select>
                        <select
                          value={watermarkChoice}
                          onChange={(e) => setWatermarkChoice(e.target.value as any)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        >
                          <option value="NONE">No watermark</option>
                          <option value="DRAFT">Watermark: Draft</option>
                          <option value="FINAL">Watermark: Final</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={includeCoverSheet} onChange={(e) => setIncludeCoverSheet(e.target.checked)} className="w-4 h-4 text-blue-600" />
                          Include cover sheet (combined PDF)
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={includeCsvSummary} onChange={(e) => setIncludeCsvSummary(e.target.checked)} className="w-4 h-4 text-blue-600" />
                          Add CSV summary
                        </label>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Preview before batch</label>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Select up to 3 sample students to validate layout, margins, and branding before generating for the whole class.</p>
                      <div className="flex flex-wrap gap-2">
                        {studentsWithDebt.slice(0, 6).map((student) => (
                          <button
                            key={student.id}
                            disabled={student.hasDebt || !student.reportExists || isGenerating}
                            onClick={() => togglePreviewStudent(student.id)}
                            className={`px-3 py-1 rounded-full border text-xs font-medium ${samplePreviewIds.has(student.id) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 dark:text-slate-300'}`}
                          >
                            {student.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handlePreviewSample}
                          disabled={previewing || isGenerating}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {previewing ? <Spinner size="sm" /> : 'Preview sample PDF'}
                        </button>
                        {previewUrl && (
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 hover:underline font-semibold"
                          >
                            Open preview
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Quality checks</p>
                  <ul className="text-sm text-slate-700 dark:text-slate-300 list-disc list-inside space-y-1">
                    <li>Only students without outstanding debt and with existing reports are eligible.</li>
                    <li>Print-safe A4 canvas with 6mm margins enforced for every page.</li>
                    <li>Watermarks, cover sheet, and CSV export options recorded in the job report.</li>
                  </ul>
                  {jobReport.failures.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <p className="font-semibold mb-1">Failures</p>
                      <ul className="space-y-1 max-h-24 overflow-y-auto">
                        {jobReport.failures.map((failure) => (
                          <li key={failure.name}>{failure.name}: {failure.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {jobReport.successes.length > 0 && (
                    <p className="text-xs text-green-700">Completed {jobReport.successes.length} PDF(s).</p>
                  )}
                  <div className="text-xs text-slate-500">
                    Status: <span className="font-semibold text-slate-800 dark:text-slate-100">{jobStatus}</span>
                  </div>
                </div>
              </div>

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
          {generationProgress && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
                <span>{jobStatus === 'completed' ? 'Job completed' : 'Generating report cards...'}</span>
                <span>
                  {generationProgress.current} of {generationProgress.total}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${jobStatus === 'completed' ? 'bg-green-500' : 'bg-blue-600'} transition-all duration-300`}
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
                onClick={handleGenerateReports}
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
                    {outputMode === 'zip' ? 'Generate ZIP (per student)' : 'Generate combined PDF'}
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
