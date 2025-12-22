import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { Student, SchoolConfig } from '../types';
import Spinner from './common/Spinner';
import { CloseIcon, DownloadIcon, CheckCircleIcon, AlertCircleIcon } from './common/icons';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { UnifiedReportCard } from './reports/UnifiedReportCard';
import { createStudentSlug } from '../utils/reportUrlHelpers';
import { buildUnifiedReportData } from '../utils/buildUnifiedReportData';
import type { WatermarkType } from '../types/reportCardPrint';
import { generateBulkGoalAnalyses } from '../services/goalAnalysisService';
import { 
  validateBulkReportCardData, 
  allValidationsPassed, 
  getValidationSummary,
  formatValidationError,
  type ValidationResult
} from '../services/reportCardValidationService';

interface BulkReportCardGeneratorProps {
  classId: number;
  className: string;
  termId: number;
  termName: string;
  students: Student[];
  onClose: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  schoolConfig: SchoolConfig | null;
}

interface StudentWithDebt extends Student {
  hasDebt: boolean;
  outstandingAmount: number;
  averageScore?: number;
  reportExists: boolean;
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
  // Template choice removed - now fetched from school_config or class config
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<'idle' | 'queued' | 'validating' | 'generating' | 'packaging' | 'completed' | 'failed'>('idle');
  const [jobReport, setJobReport] = useState<{ successes: string[]; failures: { name: string; reason: string }[] }>({ successes: [], failures: [] });
  const [samplePreviewIds, setSamplePreviewIds] = useState<Set<number>>(new Set());
  const reportContainerRef = useRef<HTMLDivElement>(null);
  
  // Validation state
  const [validationResults, setValidationResults] = useState<Map<number, ValidationResult>>(new Map());
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Sharing state
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [isSharingLinks, setIsSharingLinks] = useState(false);
  const [shareExpiryHours, setShareExpiryHours] = useState(72);
  const [shareResults, setShareResults] = useState<Array<{ studentName: string; link?: string; error?: string }>>([]);

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

  /**
   * Get template layout from centralized config
   * Priority: class-level override > school default > fallback to 'classic'
   */
  const getTemplateForClass = async (): Promise<string> => {
    try {
      const supabase = requireSupabaseClient();
      
      // First check class-level override
      const { data: classData } = await supabase
        .from('academic_classes')
        .select('report_config')
        .eq('id', classId)
        .maybeSingle();
      
      if (classData?.report_config?.layout) {
        return classData.report_config.layout;
      }
      
      // Fall back to school default
      if (schoolConfig?.default_template_id) {
        const { data: template } = await supabase
          .from('report_templates')
          .select('name')
          .eq('id', schoolConfig.default_template_id)
          .maybeSingle();
        
        if (template?.name) {
          return template.name.toLowerCase();
        }
      }
      
      return 'classic'; // Ultimate fallback
    } catch (error) {
      console.error('Error fetching template config:', error);
      return 'classic';
    }
  };


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
      const supabase = requireSupabaseClient();
      
      // Get students in this class
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

    const template = await getTemplateForClass();
    const result = await generateStudentReportPDF(targetStudent, template, watermarkChoice === 'NONE' ? undefined : watermarkChoice);
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

  // Maximum subjects per page to avoid truncation
  const MAX_SUBJECTS_PER_PAGE = 15;

  /**
   * Renders multiple canvases for a student report, splitting subjects across pages if needed
   */
  const renderReportCanvases = async (student: StudentWithDebt, layoutOverride?: string, watermarkText?: string): Promise<HTMLCanvasElement[]> => {
    try {
      const supabase = requireSupabaseClient();
      const { data: reportData, error: reportError } = await supabase.rpc('get_student_term_report_details', {
        p_student_id: student.id,
        p_term_id: termId,
      });

      if (reportError || !reportData) {
        console.error(`Error fetching report for student ${student.name}:`, reportError);
        addToast(`Failed to fetch report for ${student.name}`, 'error');
        return [];
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

      // Override layout if specified
      if (layoutOverride && classReportConfig) {
        classReportConfig = { ...classReportConfig, layout: layoutOverride };
      } else if (layoutOverride && !classReportConfig) {
        classReportConfig = { layout: layoutOverride };
      }

      // Normalize data to UnifiedReportCardData format
      const baseUnifiedData = buildUnifiedReportData(
        reportData,
        schoolConfig,
        student.admission_number || 'N/A',
        assessmentComponents,
        classReportConfig ? { report_config: classReportConfig } : null
      );

      // Split subjects into pages if needed
      const subjects = baseUnifiedData.subjects || [];
      const pages: any[][] = [];
      
      if (subjects.length <= MAX_SUBJECTS_PER_PAGE) {
        // Single page - render as-is
        pages.push(subjects);
      } else {
        // Multiple pages - split subjects
        for (let i = 0; i < subjects.length; i += MAX_SUBJECTS_PER_PAGE) {
          pages.push(subjects.slice(i, i + MAX_SUBJECTS_PER_PAGE));
        }
      }

      // Render each page
      const canvases: HTMLCanvasElement[] = [];
      const watermark: WatermarkType = watermarkText === 'DRAFT' ? 'DRAFT' : watermarkText === 'FINAL' ? 'FINAL' : 'NONE';

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const pageData = {
          ...baseUnifiedData,
          subjects: pages[pageIndex],
        };

        // Create temporary container off-screen
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '794px'; // A4 width at 96dpi
        tempContainer.style.height = '1123px'; // A4 height at 96dpi
        document.body.appendChild(tempContainer);

        // Render UnifiedReportCard component
        const root = ReactDOM.createRoot(tempContainer);
        
        root.render(<UnifiedReportCard data={pageData} watermark={watermark} />);

        // Wait for render to complete
        await new Promise(resolve => setTimeout(resolve, 200));

        // Capture as canvas
        const canvas = await html2canvas(tempContainer, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123,
          windowWidth: 794,
          windowHeight: 1123,
        });

        // Cleanup
        root.unmount();
        document.body.removeChild(tempContainer);
        
        canvases.push(canvas);
      }

      return canvases;
    } catch (error) {
      console.error(`Error preparing canvases for ${student.name}:`, error);
      return [];
    }
  };

  /**
   * Legacy single-canvas renderer for backwards compatibility
   * @deprecated Use renderReportCanvases instead for multi-page support
   */
  const renderReportCanvas = async (student: StudentWithDebt, layoutOverride?: string, watermarkText?: string): Promise<HTMLCanvasElement | null> => {
    const canvases = await renderReportCanvases(student, layoutOverride, watermarkText);
    return canvases.length > 0 ? canvases[0] : null;
  };

  const generateStudentReportPDF = async (student: StudentWithDebt, layoutOverride?: string, watermarkText?: string): Promise<{ blob: Blob; pagesAdded: number } | null> => {
    try {
      const canvases = await renderReportCanvases(student, layoutOverride, watermarkText);
      if (!canvases || canvases.length === 0) return null;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      let totalPages = 0;
      for (let i = 0; i < canvases.length; i++) {
        const pagesAdded = appendCanvasToPdf(pdf, canvases[i], i > 0);
        totalPages += pagesAdded;
      }

      return { blob: pdf.output('blob'), pagesAdded: totalPages };
    } catch (error) {
      console.error(`Error generating PDF for student ${student.name}:`, error);
      return null;
    }
  };

  // Helper to format ordinal suffix (1st, 2nd, 3rd)

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

  const addCoverSheet = (pdf: jsPDF, totalStudents: number, template: string) => {
    const margin = 14;
    pdf.setFontSize(20);
    pdf.text('Class Report Pack', margin, 28);
    pdf.setFontSize(14);
    pdf.text(`${className} • ${termName}`, margin, 40);
    pdf.setFontSize(11);
    pdf.text(`Total students queued: ${totalStudents}`, margin, 52);
    pdf.text(`Watermark: ${watermarkChoice === 'NONE' ? 'None' : watermarkChoice}`, margin, 60);
    pdf.text(`Template: ${template}`, margin, 68);
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
    setJobStatus('validating');
    setJobReport({ successes: [], failures: [] });
    setGenerationProgress({ current: 0, total: selectedStudents.length });

    try {
      // VALIDATION STEP: Validate all selected students before generation
      addToast('Validating report card data...', 'info');
      const studentIds = selectedStudents.map(s => s.id);
      const validations = await validateBulkReportCardData(studentIds, termId);
      setValidationResults(validations);

      // Check if all validations passed
      if (!allValidationsPassed(validations)) {
        const summary = getValidationSummary(validations);
        const failedStudents = selectedStudents.filter(s => {
          const result = validations.get(s.id);
          return result && result.status !== 'success';
        });

        // Build detailed failure report
        const failures: { name: string; reason: string }[] = failedStudents.map(student => {
          const result = validations.get(student.id);
          const reason = result ? formatValidationError(result) : 'Unknown validation error';
          return { name: student.name, reason };
        });

        setJobReport({ successes: [], failures });
        setJobStatus('failed');
        setShowValidationErrors(true);
        setIsGenerating(false);
        setGenerationProgress(null);
        
        addToast(
          `Validation failed for ${summary.failed} student(s). Cannot generate report cards with incomplete data.`,
          'error'
        );
        return;
      }

      addToast('Validation passed. Generating report cards...', 'success');
    } catch (validationError: any) {
      addToast(`Validation error: ${validationError.message}`, 'error');
      setJobStatus('failed');
      setIsGenerating(false);
      setGenerationProgress(null);
      return;
    }

    setJobStatus('queued');
    const zip = new JSZip();
    const combinedPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let combinedStarted = false;
    let successCount = 0;
    let failCount = 0;
    const successes: string[] = [];
    const failures: { name: string; reason: string }[] = [];
    const watermarkValue = watermarkChoice === 'NONE' ? undefined : watermarkChoice;

    // Fetch template from centralized config
    const template = await getTemplateForClass();

    try {
      // Generate goal analyses for all selected students before creating PDFs
      addToast('Generating goal analyses...', 'info');
      const studentIds = selectedStudents.map(s => s.id);
      await generateBulkGoalAnalyses(studentIds, termId, (current, total) => {
        console.log(`Goal analysis progress: ${current}/${total}`);
      });

      if (outputMode === 'combined' && includeCoverSheet) {
        addCoverSheet(combinedPdf, selectedStudents.length, template);
        combinedStarted = true;
      }

      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        setJobStatus('generating');
        setGenerationProgress({ current: i + 1, total: selectedStudents.length });

        const canvases = await renderReportCanvases(student, template, watermarkValue);
        if (!canvases || canvases.length === 0) {
          failCount++;
          failures.push({ name: student.name, reason: 'Render failed' });
          continue;
        }

        try {
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          
          // Add all canvases to the PDF
          for (let canvasIndex = 0; canvasIndex < canvases.length; canvasIndex++) {
            appendCanvasToPdf(pdf, canvases[canvasIndex], canvasIndex > 0);
          }
          
          const pdfBlob = pdf.output('blob');

          const safeName = sanitizeString(student.name);
          const admNumber = sanitizeString(student.admission_number || 'NO_ADM');
          const safeTermName = sanitizeString(termName);
          const filename = `${safeName}_${admNumber}_${safeTermName}_Report.pdf`;

          if (outputMode === 'zip') {
            zip.file(filename, pdfBlob);
          } else {
            // For combined PDF, add each canvas
            for (let canvasIndex = 0; canvasIndex < canvases.length; canvasIndex++) {
              appendCanvasToPdf(combinedPdf, canvases[canvasIndex], combinedStarted || canvasIndex > 0);
              combinedStarted = true;
            }
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

  const handleShareReportLinks = async () => {
    if (selectedStudentIds.size === 0) {
      addToast('Please select at least one student', 'error');
      return;
    }

    const selectedStudents = studentsWithDebt.filter(s => selectedStudentIds.has(s.id) && s.reportExists);
    
    if (selectedStudents.length === 0) {
      addToast('No selected students have reports to share', 'error');
      return;
    }

    setIsSharingLinks(true);
    setShareResults([]);
    const results: Array<{ studentName: string; link?: string; error?: string }> = [];

    try {
      const supabase = requireSupabaseClient();
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + shareExpiryHours);

      for (const student of selectedStudents) {
        try {
          // Get or create public token for this student's report
          const { data: existingReport, error: fetchError } = await supabase
            .from('student_term_reports')
            .select('id, public_token, token_expires_at')
            .eq('student_id', student.id)
            .eq('term_id', termId)
            .maybeSingle();

          if (fetchError) throw fetchError;

          let token = existingReport?.public_token;
          
          // Generate new token if doesn't exist or is expired
          const tokenExpired = existingReport?.token_expires_at 
            ? new Date(existingReport.token_expires_at) < new Date()
            : true;
            
          if (!token || tokenExpired) {
            token = `${student.id}-${termId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            
            const { error: updateError } = await supabase
              .from('student_term_reports')
              .update({
                public_token: token,
                token_expires_at: expiryDate.toISOString(),
                is_published: true
              })
              .eq('student_id', student.id)
              .eq('term_id', termId);

            if (updateError) throw updateError;
          }

          const studentSlug = createStudentSlug(student.name);
          const reportLink = `${window.location.origin}/report/${token}/${studentSlug}`;
          results.push({
            studentName: student.name,
            link: reportLink
          });

        } catch (error: any) {
          console.error(`Error generating link for ${student.name}:`, error);
          results.push({
            studentName: student.name,
            error: error.message || 'Failed to generate link'
          });
        }
      }

      setShareResults(results);
      const successCount = results.filter(r => r.link).length;
      const failureCount = results.filter(r => r.error).length;
      
      if (successCount > 0) {
        addToast(`Generated ${successCount} report link${successCount !== 1 ? 's' : ''}${failureCount > 0 ? ` (${failureCount} failed)` : ''}`, 'success');
      } else {
        addToast('Failed to generate report links', 'error');
      }

    } catch (error: any) {
      console.error('Error sharing report links:', error);
      addToast(`Error: ${error.message}`, 'error');
    } finally {
      setIsSharingLinks(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast('Link copied to clipboard!', 'success');
    }).catch(err => {
      console.error('Failed to copy:', err);
      addToast('Failed to copy link', 'error');
    });
  };

  const handleExportCSV = () => {
    const successfulResults = shareResults.filter(r => r.link);
    if (successfulResults.length === 0) {
      addToast('No links to export', 'error');
      return;
    }
    
    const header = ['Student Name', 'Admission Number', 'Report Link'];
    const rows = successfulResults.map(result => {
      const student = studentsWithDebt.find(s => s.name === result.studentName);
      return [
        `"${result.studentName}"`,
        `"${student?.admission_number || 'N/A'}"`,
        `"${result.link}"`
      ].join(',');
    });
    
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeString(className)}_${sanitizeString(termName)}_ReportLinks.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addToast('CSV exported successfully!', 'success');
  };

  const handleCopyAllLinks = () => {
    const successfulResults = shareResults.filter(r => r.link);
    if (successfulResults.length === 0) {
      addToast('No links to copy', 'error');
      return;
    }
    
    const formattedText = `Report Card Links - ${className} - ${termName}\n\n` +
      successfulResults.map(result => 
        `Student Name: ${result.studentName}\nLink: ${result.link}`
      ).join('\n\n');
    
    navigator.clipboard.writeText(formattedText).then(() => {
      addToast(`Copied ${successfulResults.length} links to clipboard!`, 'success');
    }).catch(err => {
      console.error('Failed to copy:', err);
      addToast('Failed to copy links', 'error');
    });
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

                      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Watermark</label>
                      <select
                        value={watermarkChoice}
                        onChange={(e) => setWatermarkChoice(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      >
                        <option value="NONE">No watermark</option>
                        <option value="DRAFT">Watermark: Draft</option>
                        <option value="FINAL">Watermark: Final</option>
                      </select>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Template is auto-selected from school/class configuration
                      </p>

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
                    <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
                      <p className="font-semibold mb-1">
                        {showValidationErrors ? 'Validation Failures' : 'Generation Failures'}
                      </p>
                      <ul className="space-y-1 max-h-24 overflow-y-auto">
                        {jobReport.failures.map((failure, index) => (
                          <li key={`${failure.name}-${index}`}>{failure.name}: {failure.reason}</li>
                        ))}
                      </ul>
                      {showValidationErrors && (
                        <p className="mt-2 text-xs">
                          Report cards cannot be generated when data is incomplete. 
                          Please fix the issues above and try again.
                        </p>
                      )}
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
                <span>
                  {jobStatus === 'completed' ? 'Job completed' : 
                   jobStatus === 'validating' ? 'Validating data...' :
                   jobStatus === 'failed' ? 'Validation/Generation failed' :
                   'Generating report cards...'}
                </span>
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
              <button
                onClick={() => setShowSharingModal(true)}
                disabled={selectedStudentIds.size === 0 || isGenerating || isSharingLinks}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
              >
                📧 Share Links
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden container for rendering reports */}
      <div ref={reportContainerRef} style={{ position: 'absolute', left: '-9999px' }} />

      {/* Share Links Modal */}
      {showSharingModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Share Report Card Links</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Generate shareable links for selected students
                </p>
              </div>
              <button
                onClick={() => setShowSharingModal(false)}
                disabled={isSharingLinks}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                <CloseIcon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-auto">
              {shareResults.length === 0 ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Link Expiry
                    </label>
                    <select
                      value={shareExpiryHours}
                      onChange={(e) => setShareExpiryHours(Number(e.target.value))}
                      disabled={isSharingLinks}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50"
                    >
                      <option value={24}>24 hours</option>
                      <option value={48}>48 hours (2 days)</option>
                      <option value={72}>72 hours (3 days)</option>
                      <option value={168}>1 week</option>
                      <option value={336}>2 weeks</option>
                      <option value={720}>30 days</option>
                    </select>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> Links will be generated for {selectedStudentIds.size} selected student{selectedStudentIds.size !== 1 ? 's' : ''} who have reports available. 
                      You can copy and share these links via email, WhatsApp, or any other channel.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Generated Links ({shareResults.length})
                    </h4>
                  </div>

                  {/* Export Buttons */}
                  {shareResults.filter(r => r.link).length > 0 && (
                    <div className="flex gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                      <button
                        onClick={handleExportCSV}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                      >
                        <DownloadIcon className="w-5 h-5" />
                        Export as CSV
                      </button>
                      <button
                        onClick={handleCopyAllLinks}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                      >
                        📋 Copy All Links
                      </button>
                    </div>
                  )}
                  
                  {shareResults.map((result, index) => (
                    <div
                      key={index}
                      className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {result.studentName}
                        </span>
                        {result.link ? (
                          <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertCircleIcon className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      
                      {result.link ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={result.link}
                            readOnly
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-sm font-mono text-slate-700 dark:text-slate-300"
                          />
                          <button
                            onClick={() => copyToClipboard(result.link!)}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                          >
                            Copy
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          Error: {result.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSharingModal(false);
                  setShareResults([]);
                }}
                disabled={isSharingLinks}
                className="px-6 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 font-medium"
              >
                {shareResults.length > 0 ? 'Close' : 'Cancel'}
              </button>
              
              {shareResults.length === 0 && (
                <button
                  onClick={handleShareReportLinks}
                  disabled={isSharingLinks}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
                >
                  {isSharingLinks ? (
                    <>
                      <Spinner size="sm" />
                      Generating Links...
                    </>
                  ) : (
                    <>
                      📧 Generate Links
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkReportCardGenerator;
