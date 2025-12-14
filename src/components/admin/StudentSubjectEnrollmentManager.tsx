
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import type { Student, AcademicClass, Term, StudentSubjectEnrollment, AcademicClassStudent } from '../../types';
import Spinner from '../common/Spinner';
import { 
  SearchIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  DownloadIcon, 
  UploadCloudIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ViewColumnsIcon,
  Squares2x2Icon,
  FilterIcon,
  ChevronDownIcon
} from '../common/icons';

interface StudentSubjectEnrollmentManagerProps {
  schoolId: number;
  students: Student[];
  allSubjects: { id: number; name: string }[];
  academicClasses: AcademicClass[];
  terms: Term[];
  studentSubjectEnrollments: StudentSubjectEnrollment[];
  academicClassStudents: AcademicClassStudent[];
  onRefreshData: () => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const StudentSubjectEnrollmentManager: React.FC<StudentSubjectEnrollmentManagerProps> = ({ 
  schoolId,
  students,
  allSubjects,
  academicClasses,
  terms,
  studentSubjectEnrollments,
  academicClassStudents,
  onRefreshData,
  addToast 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAcademicClassId, setSelectedAcademicClassId] = useState<number | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [classSubjects, setClassSubjects] = useState<{ id: number; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // UI state
  const [isCompactView, setIsCompactView] = useState(false);
  const [enrollmentFilter, setEnrollmentFilter] = useState<'all' | 'enrolled' | 'not-enrolled'>('all');
  const [isMobileView, setIsMobileView] = useState(false);
  
  // Bulk selection state
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  
  // Scroll indicator state
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Keyboard navigation state
  const [focusedCell, setFocusedCell] = useState<{ studentIndex: number; subjectIndex: number } | null>(null);

  // Get the current term (most recent active term)
  useEffect(() => {
    if (terms.length > 0 && !selectedTermId) {
      const sortedTerms = [...terms].sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setSelectedTermId(sortedTerms[0]?.id || null);
    }
  }, [terms, selectedTermId]);

  // Get active academic classes for selected term
  const activeAcademicClasses = useMemo(() => {
    return academicClasses.filter(ac => ac.is_active);
  }, [academicClasses]);

  // Get students to show for the selected academic class and term
  // Only show students enrolled in the selected academic class for the selected term
  const enrolledStudents = useMemo(() => {
    if (!selectedAcademicClassId || !selectedTermId) return [];
    
    // Get student IDs enrolled in this academic class for this term
    const studentIdsInClass = new Set(
      academicClassStudents
        .filter(acs => 
          acs.academic_class_id === selectedAcademicClassId && 
          acs.enrolled_term_id === selectedTermId
        )
        .map(acs => acs.student_id)
    );
    
    return students
      .filter(s => studentIdsInClass.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selectedAcademicClassId, selectedTermId, academicClassStudents]);

  // Get subjects for the selected class
  useEffect(() => {
    const fetchClassSubjects = async () => {
      if (!selectedAcademicClassId) {
        setClassSubjects([]);
        return;
      }

      try {
        setIsLoading(true);
        // Get the academic class to extract level
        const selectedClass = academicClasses.find(ac => ac.id === selectedAcademicClassId);
        if (!selectedClass) return;

        // Extract the level from the class name (e.g., "JSS 1" from "JSS 1 Gold (2023/2024)")
        const level = selectedClass.level;

        // Find the base class ID
        const { data: baseClassData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', schoolId)
          .eq('name', level)
          .single();

        if (!baseClassData) {
          setClassSubjects(allSubjects);
          return;
        }

        // Get subjects for this class
        const { data: csData } = await supabase
          .from('class_subjects')
          .select('subject_id')
          .eq('class_id', baseClassData.id);

        if (csData && csData.length > 0) {
          const subjectIds = csData.map(cs => cs.subject_id);
          const subjects = allSubjects.filter(s => subjectIds.includes(s.id));
          setClassSubjects(subjects);
        } else {
          // If no class subjects defined, show all subjects
          setClassSubjects(allSubjects);
        }
      } catch (error) {
        console.error('Error fetching class subjects:', error);
        setClassSubjects(allSubjects);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClassSubjects();
  }, [selectedAcademicClassId, academicClasses, allSubjects, schoolId]);

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle scroll indicators
  const handleScroll = useCallback(() => {
    const el = tableContainerRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }
  }, []);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (el) {
      handleScroll();
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, enrollmentFilter, selectedAcademicClassId, selectedTermId]);

  // Helper function to generate enrollment lookup key
  const getEnrollmentKey = (studentId: number, subjectId: number) => 
    `${studentId}:${subjectId}`;

  // Create a lookup map for O(1) enrollment checks
  const enrollmentMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!selectedAcademicClassId || !selectedTermId) return map;
    
    // Pre-filter enrollments for the selected class and term
    const relevantEnrollments = studentSubjectEnrollments.filter(sse =>
      sse.academic_class_id === selectedAcademicClassId &&
      sse.term_id === selectedTermId
    );
    
    // Build lookup map with composite key
    for (const sse of relevantEnrollments) {
      const key = getEnrollmentKey(sse.student_id, sse.subject_id);
      map.set(key, sse.is_enrolled);
    }
    
    return map;
  }, [studentSubjectEnrollments, selectedAcademicClassId, selectedTermId]);

  // Check if a student is enrolled in a subject - O(1) lookup
  const isEnrolled = useCallback((studentId: number, subjectId: number) => {
    if (!selectedAcademicClassId || !selectedTermId) return false;
    
    const key = getEnrollmentKey(studentId, subjectId);
    return enrollmentMap.get(key) ?? false;
  }, [enrollmentMap, selectedAcademicClassId, selectedTermId]);

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    let filtered = enrolledStudents;
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(term) ||
        s.admission_number?.toLowerCase().includes(term)
      );
    }
    
    // Apply enrollment filter
    if (enrollmentFilter !== 'all' && classSubjects.length > 0) {
      filtered = filtered.filter(student => {
        const enrolledCount = classSubjects.filter(subject => 
          isEnrolled(student.id, subject.id)
        ).length;
        
        if (enrollmentFilter === 'enrolled') {
          return enrolledCount > 0;
        } else {
          return enrolledCount === 0;
        }
      });
    }
    
    return filtered;
  }, [enrolledStudents, searchTerm, enrollmentFilter, classSubjects, isEnrolled]);

  // Calculate enrollment statistics
  const enrollmentStats = useMemo(() => {
    return classSubjects.map(subject => {
      const enrolledCount = filteredStudents.filter(s => isEnrolled(s.id, subject.id)).length;
      const total = filteredStudents.length;
      const percentage = total > 0 ? (enrolledCount / total) * 100 : 0;
      
      return {
        subjectId: subject.id,
        enrolled: enrolledCount,
        total,
        percentage
      };
    });
  }, [classSubjects, filteredStudents, isEnrolled]);

  // Paginate filtered students
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredStudents.slice(startIndex, startIndex + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize);

  // Toggle enrollment for a student-subject combination
  const toggleEnrollment = async (studentId: number, subjectId: number) => {
    if (!selectedAcademicClassId || !selectedTermId) {
      addToast('Please select an academic class and term', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const currentEnrollment = studentSubjectEnrollments.find(sse =>
        sse.student_id === studentId &&
        sse.subject_id === subjectId &&
        sse.academic_class_id === selectedAcademicClassId &&
        sse.term_id === selectedTermId
      );

      const newEnrollmentStatus = !isEnrolled(studentId, subjectId);

      if (currentEnrollment) {
        // Update existing record - timestamp updated automatically by database
        const { error } = await supabase
          .from('student_subject_enrollments')
          .update({ 
            is_enrolled: newEnrollmentStatus
          })
          .eq('id', currentEnrollment.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('student_subject_enrollments')
          .insert({
            school_id: schoolId,
            student_id: studentId,
            subject_id: subjectId,
            academic_class_id: selectedAcademicClassId,
            term_id: selectedTermId,
            is_enrolled: newEnrollmentStatus
          });

        if (error) throw error;
      }

      await onRefreshData();
      addToast(`Enrollment ${newEnrollmentStatus ? 'enabled' : 'disabled'} successfully`, 'success');
    } catch (error) {
      console.error('Error toggling enrollment:', error);
      addToast('Failed to update enrollment', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk enroll/unenroll all students for a subject
  const bulkToggleSubject = async (subjectId: number, enroll: boolean) => {
    if (!selectedAcademicClassId || !selectedTermId) {
      addToast('Please select an academic class and term', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const updates = filteredStudents.map(student => ({
        school_id: schoolId,
        student_id: student.id,
        subject_id: subjectId,
        academic_class_id: selectedAcademicClassId,
        term_id: selectedTermId,
        is_enrolled: enroll
      }));

      // Use upsert to ensure atomicity - timestamps handled by database
      const { error } = await supabase
        .from('student_subject_enrollments')
        .upsert(updates, {
          onConflict: 'student_id,subject_id,academic_class_id,term_id'
        });

      if (error) throw error;

      await onRefreshData();
      addToast(`All students ${enroll ? 'enrolled' : 'unenrolled'} successfully`, 'success');
    } catch (error) {
      console.error('Error bulk toggling enrollment:', error);
      addToast('Failed to update enrollments', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk selection handlers
  const toggleStudentSelection = (studentId: number) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);
  };

  const selectAllStudents = () => {
    setSelectedStudents(new Set(paginatedStudents.map(s => s.id)));
  };

  const deselectAllStudents = () => {
    setSelectedStudents(new Set());
  };

  const bulkEnrollSelected = async (subjectId?: number, enroll: boolean = true) => {
    if (!selectedAcademicClassId || !selectedTermId || selectedStudents.size === 0) {
      addToast('Please select students', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const updates: Array<{
        school_id: number;
        student_id: number;
        subject_id: number;
        academic_class_id: number;
        term_id: number;
        is_enrolled: boolean;
      }> = [];

      const subjects = subjectId ? [classSubjects.find(s => s.id === subjectId)!] : classSubjects;
      
      selectedStudents.forEach(studentId => {
        subjects.forEach(subject => {
          updates.push({
            school_id: schoolId,
            student_id: studentId,
            subject_id: subject.id,
            academic_class_id: selectedAcademicClassId,
            term_id: selectedTermId,
            is_enrolled: enroll
          });
        });
      });

      const { error } = await supabase
        .from('student_subject_enrollments')
        .upsert(updates, {
          onConflict: 'student_id,subject_id,academic_class_id,term_id'
        });

      if (error) throw error;

      await onRefreshData();
      addToast(`${selectedStudents.size} student(s) updated successfully`, 'success');
      setSelectedStudents(new Set());
      setIsBulkMode(false);
    } catch (error) {
      console.error('Error bulk enrolling:', error);
      addToast('Failed to update enrollments', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, studentIndex: number, subjectIndex: number) => {
    const student = paginatedStudents[studentIndex];
    const subject = classSubjects[subjectIndex];
    
    if (!student || !subject) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        toggleEnrollment(student.id, subject.id);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (studentIndex > 0) {
          setFocusedCell({ studentIndex: studentIndex - 1, subjectIndex });
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (studentIndex < paginatedStudents.length - 1) {
          setFocusedCell({ studentIndex: studentIndex + 1, subjectIndex });
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (subjectIndex > 0) {
          setFocusedCell({ studentIndex, subjectIndex: subjectIndex - 1 });
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (subjectIndex < classSubjects.length - 1) {
          setFocusedCell({ studentIndex, subjectIndex: subjectIndex + 1 });
        }
        break;
    }
  }, [paginatedStudents, classSubjects, toggleEnrollment]);

  // Auto-focus cell when focusedCell changes
  useEffect(() => {
    if (focusedCell) {
      const cellId = `cell-${focusedCell.studentIndex}-${focusedCell.subjectIndex}`;
      const element = document.getElementById(cellId);
      if (element) {
        element.focus();
      }
    }
  }, [focusedCell]);

  // Download CSV template with current enrollments
  const downloadCSV = () => {
    if (!selectedAcademicClassId || !selectedTermId) {
      addToast('Please select an academic class and term first', 'error');
      return;
    }

    const selectedClass = academicClasses.find(ac => ac.id === selectedAcademicClassId);
    const selectedTerm = terms.find(t => t.id === selectedTermId);

    // Create CSV header
    const headers = ['Student ID', 'Student Name', 'Admission Number', ...classSubjects.map(s => s.name)];
    const csvRows = [headers.join(',')];

    // Add data rows
    filteredStudents.forEach(student => {
      const row = [
        student.id,
        `"${student.name}"`, // Quote names in case they contain commas
        student.admission_number || '',
        ...classSubjects.map(subject => {
          const enrolled = isEnrolled(student.id, subject.id);
          return enrolled ? '1' : '0';
        })
      ];
      csvRows.push(row.join(','));
    });

    // Create and download file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `subject_enrollment_${selectedClass?.name}_${selectedTerm?.term_label}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('CSV downloaded successfully', 'success');
  };

  // Upload and process CSV file
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedAcademicClassId || !selectedTermId) {
      addToast('Please select an academic class and term first', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const text = await file.text();
      const rows = text.split('\n').map(row => row.trim()).filter(row => row);
      
      if (rows.length < 2) {
        addToast('CSV file is empty or invalid', 'error');
        return;
      }

      // Parse header to get subject names and positions
      const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const subjectStartIndex = 3; // After Student ID, Student Name, Admission Number
      const subjectHeaders = headers.slice(subjectStartIndex);

      // Map subject names to IDs
      const subjectMap = new Map<string, number>();
      subjectHeaders.forEach(subjectName => {
        const subject = classSubjects.find(s => s.name === subjectName);
        if (subject) {
          subjectMap.set(subjectName, subject.id);
        }
      });

      if (subjectMap.size === 0) {
        addToast('No matching subjects found in CSV', 'error');
        return;
      }

      // Parse data rows and build enrollment records
      const enrollments: Array<{
        school_id: number;
        student_id: number;
        subject_id: number;
        academic_class_id: number;
        term_id: number;
        is_enrolled: boolean;
      }> = [];

      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const studentId = parseInt(cells[0]);
        
        if (isNaN(studentId)) continue;

        // Check if student exists
        const student = filteredStudents.find(s => s.id === studentId);
        if (!student) {
          console.warn(`Student ID ${studentId} not found, skipping row ${i + 1}`);
          continue;
        }

        // Process each subject column
        subjectHeaders.forEach((subjectName, index) => {
          const subjectId = subjectMap.get(subjectName);
          if (!subjectId) return;

          const cellValue = cells[subjectStartIndex + index];
          const shouldEnroll = cellValue === '1' || cellValue.toLowerCase() === 'true' || cellValue.toLowerCase() === 'yes';

          enrollments.push({
            school_id: schoolId,
            student_id: studentId,
            subject_id: subjectId,
            academic_class_id: selectedAcademicClassId,
            term_id: selectedTermId,
            is_enrolled: shouldEnroll
          });
        });
      }

      if (enrollments.length === 0) {
        addToast('No valid enrollment data found in CSV', 'error');
        return;
      }

      // Use upsert to update all enrollments
      const { error } = await supabase
        .from('student_subject_enrollments')
        .upsert(enrollments, {
          onConflict: 'student_id,subject_id,academic_class_id,term_id'
        });

      if (error) throw error;

      await onRefreshData();
      addToast(`Successfully imported ${enrollments.length} enrollment records`, 'success');
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading CSV:', error);
      addToast('Failed to upload CSV file', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (activeAcademicClasses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 dark:text-slate-400">No active academic classes found. Please create academic classes first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in h-full overflow-y-auto pb-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Student Subject Enrollment</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-1">
          Manage which students are enrolled in which subjects for each class and term.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Academic Class
            </label>
            <select
              value={selectedAcademicClassId || ''}
              onChange={(e) => setSelectedAcademicClassId(Number(e.target.value) || null)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a class...</option>
              {activeAcademicClasses.map(ac => (
                <option key={ac.id} value={ac.id}>{ac.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Term
            </label>
            <select
              value={selectedTermId || ''}
              onChange={(e) => setSelectedTermId(Number(e.target.value) || null)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a term...</option>
              {terms.map(t => (
                <option key={t.id} value={t.id}>
                  {t.session_label} - {t.term_label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Search Students
            </label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or admission number..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-10 pr-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Import/Export Section */}
      {selectedAcademicClassId && selectedTermId && (
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bulk Import/Export</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Download template, edit in Excel, then upload to update enrollments in bulk</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={downloadCSV}
                disabled={filteredStudents.length === 0 || classSubjects.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                <DownloadIcon className="w-4 h-4" />
                Download CSV
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 cursor-pointer transition-colors">
                <UploadCloudIcon className="w-4 h-4" />
                Upload CSV
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* View Controls */}
      {selectedAcademicClassId && selectedTermId && !isMobileView && (
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Compact View Toggle */}
              <button
                onClick={() => setIsCompactView(!isCompactView)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  isCompactView
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                title={isCompactView ? 'Switch to normal view' : 'Switch to compact view'}
              >
                {isCompactView ? <Squares2x2Icon className="w-4 h-4" /> : <ViewColumnsIcon className="w-4 h-4" />}
                {isCompactView ? 'Compact' : 'Normal'}
              </button>

              {/* Enrollment Filter */}
              <div className="flex items-center gap-2">
                <FilterIcon className="w-4 h-4 text-slate-500" />
                <select
                  value={enrollmentFilter}
                  onChange={(e) => setEnrollmentFilter(e.target.value as 'all' | 'enrolled' | 'not-enrolled')}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Students</option>
                  <option value="enrolled">Enrolled Only</option>
                  <option value="not-enrolled">Not Enrolled</option>
                </select>
              </div>

              {/* Bulk Selection Toggle */}
              <button
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  if (isBulkMode) {
                    setSelectedStudents(new Set());
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  isBulkMode
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <CheckCircleIcon className="w-4 h-4" />
                {isBulkMode ? 'Exit Bulk Mode' : 'Bulk Select'}
              </button>
            </div>

            {/* Summary Stats */}
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Total: <span className="font-semibold text-slate-900 dark:text-white">{filteredStudents.length}</span> students
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {isBulkMode && selectedStudents.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-purple-600 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4">
            <span className="font-semibold">{selectedStudents.size} student(s) selected</span>
            <div className="h-6 w-px bg-purple-400"></div>
            <button
              onClick={() => bulkEnrollSelected(undefined, true)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              Enroll in All Subjects
            </button>
            <button
              onClick={() => bulkEnrollSelected(undefined, false)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              Unenroll from All
            </button>
            <button
              onClick={deselectAllStudents}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Enrollment Matrix */}
      {selectedAcademicClassId && selectedTermId ? (
        isMobileView ? (
          /* Mobile Card View */
          <div className="space-y-4">
            {paginatedStudents.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-12 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 text-center">
                <p className="text-slate-600 dark:text-slate-400">No students found</p>
              </div>
            ) : (
              paginatedStudents.map(student => (
                <div key={student.id} className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                  <div className="font-semibold text-slate-900 dark:text-white mb-3">
                    {student.name}
                    {student.admission_number && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                        {student.admission_number}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {classSubjects.map(subject => {
                      const enrolled = isEnrolled(student.id, subject.id);
                      return (
                        <div key={subject.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <span className="text-sm text-slate-700 dark:text-slate-300">{subject.name}</span>
                          <button
                            onClick={() => toggleEnrollment(student.id, subject.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                              enrolled
                                ? 'bg-green-500 text-white'
                                : 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {enrolled ? 'Enrolled' : 'Not Enrolled'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
            {isLoading || isSaving ? (
              <div className="flex justify-center items-center py-12">
                <Spinner size="lg" />
              </div>
            ) : (
              <>
                <div className="relative">
                  {/* Scroll Indicators */}
                  {canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-900/10 to-transparent dark:from-slate-100/10 z-10 pointer-events-none"></div>
                  )}
                  {canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-900/10 to-transparent dark:from-slate-100/10 z-10 pointer-events-none flex items-center justify-center">
                      <ArrowRightIcon className="w-5 h-5 text-slate-400 animate-pulse" />
                    </div>
                  )}
                  
                  <div 
                    ref={tableContainerRef}
                    className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]"
                  >
                    <table className="w-full text-sm min-w-max">
                      <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-800 sticky top-0 z-20">
                        {/* Summary Row */}
                        <tr className="bg-blue-50 dark:bg-blue-900/20">
                          <th className={`${isCompactView ? 'px-3 py-2' : 'px-6 py-3'} text-left font-semibold sticky left-0 bg-blue-50 dark:bg-blue-900/20 z-30 border-r border-slate-200 dark:border-slate-700`}>
                            <div className="text-xs">
                              Total: <span className="font-bold">{filteredStudents.length}</span>
                            </div>
                          </th>
                          {enrollmentStats.map(stat => {
                            const colorClass = 
                              stat.percentage >= 80 ? 'text-green-700 dark:text-green-400' :
                              stat.percentage >= 50 ? 'text-yellow-700 dark:text-yellow-400' :
                              'text-red-700 dark:text-red-400';
                            return (
                              <th key={stat.subjectId} className={`${isCompactView ? 'px-2 py-2' : 'px-4 py-3'} text-center bg-blue-50 dark:bg-blue-900/20 border-r border-slate-200 dark:border-slate-700 last:border-r-0`}>
                                <div className={`text-xs font-bold ${colorClass}`}>
                                  {stat.enrolled}/{stat.total}
                                </div>
                                <div className="mt-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all ${
                                      stat.percentage >= 80 ? 'bg-green-500' :
                                      stat.percentage >= 50 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${stat.percentage}%` }}
                                  ></div>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                        
                        {/* Header Row */}
                        <tr>
                          <th className={`${isCompactView ? 'px-3 py-2' : 'px-6 py-3'} text-left font-semibold sticky left-0 bg-slate-50 dark:bg-slate-800 z-30 border-r border-slate-200 dark:border-slate-700`}>
                            {isBulkMode && (
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="checkbox"
                                  checked={selectedStudents.size === paginatedStudents.length && paginatedStudents.length > 0}
                                  onChange={(e) => e.target.checked ? selectAllStudents() : deselectAllStudents()}
                                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-xs">All</span>
                              </div>
                            )}
                            <span>Student</span>
                          </th>
                          {classSubjects.map((subject, idx) => {
                            const stat = enrollmentStats[idx];
                            const badgeColor = 
                              stat.percentage >= 80 ? 'bg-green-500/20 text-green-800 dark:text-green-300' :
                              stat.percentage >= 50 ? 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-300' :
                              'bg-red-500/20 text-red-800 dark:text-red-300';
                            
                            return (
                              <th key={subject.id} className={`${isCompactView ? 'px-2 py-2' : 'px-4 py-3'} text-center font-semibold bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 last:border-r-0 min-w-[140px]`}>
                                <div className="flex flex-col items-center space-y-2">
                                  <span className="max-w-[120px] truncate" title={subject.name}>
                                    {subject.name}
                                  </span>
                                  <div className={`text-xs px-2 py-1 rounded ${badgeColor}`}>
                                    {stat.enrolled}/{stat.total}
                                  </div>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => bulkToggleSubject(subject.id, true)}
                                      className="px-2 py-1 text-xs bg-green-500/20 text-green-800 dark:text-green-300 rounded hover:bg-green-500/30"
                                      title="Enroll all"
                                    >
                                      All ✓
                                    </button>
                                    <button
                                      onClick={() => bulkToggleSubject(subject.id, false)}
                                      className="px-2 py-1 text-xs bg-red-500/20 text-red-800 dark:text-red-300 rounded hover:bg-red-500/30"
                                      title="Unenroll all"
                                    >
                                      None ✗
                                    </button>
                                  </div>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedStudents.length === 0 ? (
                          <tr>
                            <td colSpan={classSubjects.length + 1} className="px-6 py-8 text-center text-slate-500">
                              No students found
                            </td>
                          </tr>
                        ) : (
                          paginatedStudents.map((student, studentIndex) => (
                            <tr key={student.id} className="border-b border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-500/5">
                              <td className={`${isCompactView ? 'px-3 py-2' : 'px-6 py-4'} font-medium text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-900 backdrop-blur-xl z-10 border-r border-slate-200 dark:border-slate-700`}>
                                <div className="flex items-center gap-2">
                                  {isBulkMode && (
                                    <input
                                      type="checkbox"
                                      checked={selectedStudents.has(student.id)}
                                      onChange={() => toggleStudentSelection(student.id)}
                                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                    />
                                  )}
                                  <div>
                                    <div className="font-semibold">{student.name}</div>
                                    {student.admission_number && (
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {student.admission_number}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {classSubjects.map((subject, subjectIndex) => {
                                const enrolled = isEnrolled(student.id, subject.id);
                                const isFocused = focusedCell?.studentIndex === studentIndex && focusedCell?.subjectIndex === subjectIndex;
                                return (
                                  <td key={subject.id} className={`${isCompactView ? 'px-2 py-2' : 'px-4 py-4'} text-center border-r border-slate-200 dark:border-slate-700 last:border-r-0`}>
                                    <button
                                      id={`cell-${studentIndex}-${subjectIndex}`}
                                      onClick={() => toggleEnrollment(student.id, subject.id)}
                                      onKeyDown={(e) => handleKeyDown(e, studentIndex, subjectIndex)}
                                      onFocus={() => setFocusedCell({ studentIndex, subjectIndex })}
                                      className={`${isCompactView ? 'w-6 h-6' : 'w-8 h-8'} rounded-lg flex items-center justify-center transition-all ${
                                        enrolled
                                          ? 'bg-green-500/20 text-green-800 dark:text-green-300 hover:bg-green-500/30'
                                          : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-400 hover:bg-slate-300/60 dark:hover:bg-slate-600/60'
                                      } ${isFocused ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                      title={enrolled ? 'Click to unenroll (Space/Enter)' : 'Click to enroll (Space/Enter)'}
                                      tabIndex={0}
                                    >
                                      {enrolled ? (
                                        <CheckCircleIcon className={isCompactView ? 'w-4 h-4' : 'w-5 h-5'} />
                                      ) : (
                                        <XCircleIcon className={isCompactView ? 'w-4 h-4' : 'w-5 h-5'} />
                                      )}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-slate-600 dark:text-slate-400">
                          Show:
                        </label>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="10">10</option>
                          <option value="20">20</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                        </select>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          students per page
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          Page {currentPage} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                          >
                            <ArrowLeftIcon className="w-4 h-4" />
                            Previous
                          </button>
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                          >
                            Next
                            <ArrowRightIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-12 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Please select an academic class and term to manage enrollments.
          </p>
        </div>
      )}

      {/* Info */}
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">ℹ️ How it works</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>Select an academic class and term to view and manage student enrollments</li>
          <li><strong>Pagination:</strong> Navigate through students using Previous/Next buttons and adjust page size</li>
          <li><strong>View Modes:</strong> Toggle between Normal and Compact views for different data density</li>
          <li><strong>Filters:</strong> Filter students by enrollment status (All, Enrolled, Not Enrolled)</li>
          <li><strong>Bulk Actions:</strong> Enable bulk mode to select multiple students and enroll/unenroll them at once</li>
          <li><strong>Keyboard Navigation:</strong> Use Tab to navigate, Arrow keys to move, and Space/Enter to toggle enrollment</li>
          <li><strong>Stats & Progress:</strong> View enrollment statistics and progress bars for each subject at a glance</li>
          <li><strong>Bulk Import/Export:</strong> Download CSV template, edit in Excel (use 1 for enrolled, 0 for not enrolled), then upload</li>
          <li>Use "All ✓" or "None ✗" buttons to quickly enroll/unenroll all students for a subject</li>
          <li>If no enrollment records exist for a subject, teachers will see all class students (backward compatible)</li>
          <li>Once enrollment records exist, teachers will only see students with enrollment enabled</li>
        </ul>
      </div>
    </div>
  );
};

export default StudentSubjectEnrollmentManager;
