import React, { useState, useMemo, useRef } from 'react';
import type { Student, UserProfile, BaseDataObject, TeachingAssignment } from '../types';
import AddStudentModal from './AddStudentModal';
import { PlusCircleIcon, DownloadIcon, TrashIcon, UploadCloudIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS, STUDENT_STATUSES } from '../constants';
import { exportToCsv } from '../utils/export';
import { exportToExcel, type ExcelColumn } from '../utils/excelExport';
import Pagination from './common/Pagination';
import { isActiveEmployee } from '../utils/userHelpers';
import { parseCsv } from '../utils/feesCsvUtils';
import { generateAdmissionNumber } from '../utils/admissionNumber';
import { requireSupabaseClient } from '../services/supabaseClient';

interface StudentListViewProps {
  students: Student[];
  onAddStudent: (studentData: any) => Promise<boolean>;
  onUpdateStudent?: (studentId: number, studentData: Partial<Student>) => Promise<boolean>;
  onViewStudent: (student: Student) => void;
  onAddPositive: (student: Student) => void;
  onGenerateStudentAwards: () => Promise<void>;
  userPermissions: string[];
  onOpenCreateStudentAccountModal: () => void;
  allClasses: BaseDataObject[];
  allArms: BaseDataObject[];
  users: UserProfile[];
  teachingAssignments: TeachingAssignment[];
  onBulkResetStrikes?: () => Promise<void>;
  onDeleteStudent?: (studentId: number) => Promise<boolean>;
  onBulkDeleteStudents?: (studentIds: number[]) => Promise<{ success: boolean; deleted: number; total: number }>;
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const StudentListView: React.FC<StudentListViewProps> = ({
    students, onAddStudent, onUpdateStudent, onViewStudent, onAddPositive, onGenerateStudentAwards, userPermissions,
    onOpenCreateStudentAccountModal, allClasses, allArms, users, teachingAssignments, onBulkResetStrikes, onDeleteStudent, onBulkDeleteStudents, addToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [loginFilter, setLoginFilter] = useState(''); // 'missing' or ''
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGeneratingAwards, setIsGeneratingAwards] = useState(false);
  const [isDeletingStudents, setIsDeletingStudents] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Sorting State
  const [sortField, setSortField] = useState<'name' | 'admission_number' | 'class' | 'status'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Export configuration state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set([
    'name', 'admission_number', 'email', 'class', 'arm', 'status', 
    'has_account', 'date_of_birth', 'guardian_phone', 'address'
  ]));

  // CSV Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [updateExistingStudents, setUpdateExistingStudents] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManageStudents = userPermissions.includes('manage-students') || userPermissions.includes('*');

  const teachers = useMemo(() => 
    users.filter(u => (u.role === 'Teacher' || u.role === 'Team Lead') && isActiveEmployee(u)).sort((a,b) => a.name.localeCompare(b.name))
  , [users]);

  const filteredStudents = useMemo(() => {
    const searchWords = searchTerm.toLowerCase().split(' ').filter(w => w);

    const filtered = students.filter(student => {
        const studentNameLower = student.name.toLowerCase();
        const studentAdmissionNumberLower = student.admission_number?.toLowerCase() || '';
        
        const nameMatch = searchWords.length === 0 ? true : searchWords.every(word => studentNameLower.includes(word) || studentAdmissionNumberLower.includes(word));
        const statusMatch = !statusFilter || student.status === statusFilter;
        const classMatch = !classFilter || student.class_id === Number(classFilter);
        
        const teacherMatch = !teacherFilter || teachingAssignments.some(assignment => 
            assignment.user_id === teacherFilter &&
            assignment.class_id === student.class_id &&
            (assignment.arm_id === student.arm_id || assignment.arm_id === null) 
        );
        
        const loginMatch = loginFilter === 'missing' ? !student.user_id : true;
        
        return nameMatch && statusMatch && classMatch && teacherMatch && loginMatch;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
        let compareA: string | number = '';
        let compareB: string | number = '';
        
        switch (sortField) {
            case 'name':
                compareA = a.name.toLowerCase();
                compareB = b.name.toLowerCase();
                break;
            case 'admission_number':
                compareA = a.admission_number || '';
                compareB = b.admission_number || '';
                break;
            case 'class':
                compareA = a.class?.name || '';
                compareB = b.class?.name || '';
                break;
            case 'status':
                compareA = a.status || '';
                compareB = b.status || '';
                break;
        }
        
        if (sortDirection === 'asc') {
            return compareA < compareB ? -1 : compareA > compareB ? 1 : 0;
        } else {
            return compareA > compareB ? -1 : compareA < compareB ? 1 : 0;
        }
    });
  }, [students, searchTerm, statusFilter, classFilter, teacherFilter, teachingAssignments, loginFilter, sortField, sortDirection]);

  // Reset pagination when filters change
  useMemo(() => {
      setCurrentPage(1);
  }, [searchTerm, statusFilter, classFilter, teacherFilter, loginFilter]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  const handleSort = (field: 'name' | 'admission_number' | 'class' | 'status') => {
      if (sortField === field) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortField(field);
          setSortDirection('asc');
      }
  };

  const SortIcon: React.FC<{ field: string }> = ({ field }) => {
      if (sortField !== field) return <span className="ml-1 text-slate-300">↕</span>;
      return <span className="ml-1 text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };
  
  const handleAddStudent = async (studentData: any) => {
    const success = await onAddStudent(studentData);
    if (success) {
      setIsAddModalOpen(false);
    }
    return success;
  };

  const handleGenerateAwards = async () => {
    setIsGeneratingAwards(true);
    await onGenerateStudentAwards();
    setIsGeneratingAwards(false);
  };
  
  // Bulk Selection Logic
  const handleSelectAllVisible = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          const newSet = new Set(selectedIds);
          paginatedStudents.forEach(s => newSet.add(s.id));
          setSelectedIds(newSet);
      } else {
          const newSet = new Set(selectedIds);
          paginatedStudents.forEach(s => newSet.delete(s.id));
          setSelectedIds(newSet);
      }
  };

  const handleSelectOne = (id: number) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };
  
  // Helper to determine checkbox state
  const isAllVisibleSelected = paginatedStudents.length > 0 && paginatedStudents.every(s => selectedIds.has(s.id));
  
  const handleBulkDeleteStudentsClick = async () => {
      if (!onBulkDeleteStudents) return;
      
      const selectedCount = selectedIds.size;
      
      if (!window.confirm(`WARNING: You are about to PERMANENTLY DELETE ${selectedCount} student record(s). This will also delete their login accounts (if any), all associated reports, scores, and other data. This action CANNOT be undone!\n\nAre you sure you want to proceed?`)) {
          return;
      }
      
      // Double confirmation for safety
      if (!window.confirm(`FINAL WARNING: ${selectedCount} students will be permanently removed from the system. Are you absolutely sure?`)) {
          return;
      }
      
      setIsDeletingStudents(true);
      await onBulkDeleteStudents(Array.from(selectedIds));
      setIsDeletingStudents(false);
      setSelectedIds(new Set()); // Clear selection
  };

  const handleExportStudents = () => {
      const dataToExport = filteredStudents.map(s => ({
          'Name': s.name,
          'Admission Number': s.admission_number || '',
          'Email/Username': s.email || '',
          'Class': s.class?.name || '',
          'Arm': s.arm?.name || '',
          'Status': s.status || '',
          'Has Account': s.user_id ? 'Yes' : 'No',
          'Date of Birth': s.date_of_birth || '',
          'Guardian Contact': s.guardian_phone || '',
          'Address': s.address || ''
      }));
      exportToCsv(dataToExport, `students_export_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const availableFields = [
    { key: 'name', label: 'Name', header: 'Name' },
    { key: 'admission_number', label: 'Admission Number', header: 'Admission Number' },
    { key: 'email', label: 'Email/Username', header: 'Email/Username' },
    { key: 'class', label: 'Class', header: 'Class' },
    { key: 'arm', label: 'Arm', header: 'Arm' },
    { key: 'status', label: 'Status', header: 'Status' },
    { key: 'has_account', label: 'Has Account', header: 'Has Account' },
    { key: 'date_of_birth', label: 'Date of Birth', header: 'Date of Birth' },
    { key: 'address', label: 'Address', header: 'Address' },
    // Parent contact information - canonical fields
    { key: 'father_name', label: 'Father Name', header: 'Father Name' },
    { key: 'father_phone', label: 'Father Phone', header: 'Father Phone' },
    { key: 'father_email', label: 'Father Email', header: 'Father Email' },
    { key: 'mother_name', label: 'Mother Name', header: 'Mother Name' },
    { key: 'mother_phone', label: 'Mother Phone', header: 'Mother Phone' },
    { key: 'mother_email', label: 'Mother Email', header: 'Mother Email' },
    { key: 'campus', label: 'Campus', header: 'Campus' },
  ];

  const toggleField = (key: string) => {
    const newFields = new Set(selectedFields);
    if (newFields.has(key)) {
      newFields.delete(key);
    } else {
      newFields.add(key);
    }
    setSelectedFields(newFields);
  };

  const selectAllFields = () => {
    setSelectedFields(new Set(availableFields.map(f => f.key)));
  };

  const deselectAllFields = () => {
    setSelectedFields(new Set());
  };

  const handleExportWithOptions = (format: 'csv' | 'excel') => {
    // Determine which students to export
    const studentsToExport = exportSelectedOnly && selectedIds.size > 0
      ? filteredStudents.filter(s => selectedIds.has(s.id))
      : filteredStudents;

    if (studentsToExport.length === 0) {
      alert('No students to export. Please adjust your selection.');
      return;
    }

    if (selectedFields.size === 0) {
      alert('Please select at least one field to export.');
      return;
    }

    const fieldMap: Record<string, (s: Student) => string> = {
      name: (s) => s.name,
      admission_number: (s) => s.admission_number || '',
      email: (s) => s.email || '',
      class: (s) => s.class?.name || '',
      arm: (s) => s.arm?.name || '',
      status: (s) => s.status || '',
      has_account: (s) => s.user_id ? 'Yes' : 'No',
      date_of_birth: (s) => s.date_of_birth || '',
      address: (s) => s.address || '',
      // Parent contact information - canonical fields
      father_name: (s) => s.father_name || '',
      father_phone: (s) => s.father_phone || '',
      father_email: (s) => s.father_email || '',
      mother_name: (s) => s.mother_name || '',
      mother_phone: (s) => s.mother_phone || '',
      mother_email: (s) => s.mother_email || '',
      campus: (s) => s.campus?.name || '',
    };

    if (format === 'csv') {
      const dataToExport = studentsToExport.map(s => {
        const row: Record<string, string> = {};
        availableFields.forEach(field => {
          if (selectedFields.has(field.key)) {
            row[field.header] = fieldMap[field.key]?.(s) || '';
          }
        });
        return row;
      });
      
      const prefix = exportSelectedOnly ? 'selected_students' : 'students';
      exportToCsv(dataToExport, `${prefix}_export_${new Date().toISOString().split('T')[0]}.csv`);
    } else {
      // Excel export
      const columns: ExcelColumn[] = availableFields
        .filter(field => selectedFields.has(field.key))
        .map(field => ({
          key: field.key,
          header: field.header,
          width: field.key === 'address' ? 35 : field.key === 'email' ? 30 : field.key === 'name' ? 25 : field.key === 'guardian_phone' ? 20 : field.key === 'admission_number' ? 18 : field.key === 'status' ? 18 : field.key === 'date_of_birth' ? 15 : field.key === 'class' ? 15 : 12,
          type: field.key === 'date_of_birth' ? 'date' : 'string'
        }));

      const dataToExport = studentsToExport.map(s => {
        const row: Record<string, string> = {};
        availableFields.forEach(field => {
          if (selectedFields.has(field.key)) {
            row[field.key] = fieldMap[field.key]?.(s) || '';
          }
        });
        return row;
      });

      const prefix = exportSelectedOnly ? 'selected_students' : 'students';
      exportToExcel(dataToExport, columns, {
        filename: `${prefix}_export`,
        sheetName: 'Students',
        includeTimestamp: true
      });
    }

    setShowExportModal(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  // Header variations for flexible CSV matching (defined as constants to avoid recreation)
  const CSV_HEADER_VARIATIONS = {
    name: ['Name', 'name', 'Student Name', 'student_name', 'StudentName', 'Full Name', 'full_name', 'STUDENT NAME', 'NAME'],
    admissionNumber: ['Admission Number', 'admission_number', 'Admission No', 'admission_no', 'AdmissionNumber', 'Adm No', 'ID', 'Student ID', 'student_id', 'ADMISSION NUMBER'],
    email: ['Email', 'email', 'Email/Username', 'Username', 'username', 'EMAIL', 'E-mail', 'e-mail', 'Student Email'],
    className: ['Class', 'class', 'Class Name', 'class_name', 'ClassName', 'Grade', 'grade', 'CLASS', 'Form'],
    arm: ['Arm', 'arm', 'Arm Name', 'arm_name', 'Section', 'section', 'Stream', 'stream', 'ARM'],
    dob: ['Date of Birth', 'date_of_birth', 'DOB', 'dob', 'Birth Date', 'birth_date', 'Birthday', 'DATE OF BIRTH', 'Date Of Birth'],
    address: ['Address', 'address', 'Home Address', 'home_address', 'ADDRESS', 'Residential Address'],
    status: ['Status', 'status', 'Student Status', 'STATUS'],
    // Parent contact information - canonical fields with backward compatibility
    fatherName: ['Father Name', 'father_name', 'Father', 'Dad Name', 'FATHER NAME', "Father's Name"],
    fatherPhone: ['Father Phone', 'father_phone', 'Father Phone Number', 'father_phone_number', "Father's Phone", 'Dad Phone', 'FATHER PHONE'],
    fatherEmail: ['Father Email', 'father_email', 'Father Email Address', "Father's Email", 'Dad Email', 'FATHER EMAIL'],
    motherName: ['Mother Name', 'mother_name', 'Mother', 'Mom Name', 'MOTHER NAME', "Mother's Name"],
    motherPhone: ['Mother Phone', 'mother_phone', 'Mother Phone Number', 'mother_phone_number', "Mother's Phone", 'Mom Phone', 'MOTHER PHONE'],
    motherEmail: ['Mother Email', 'mother_email', 'Mother Email Address', "Mother's Email", 'Mom Email', 'MOTHER EMAIL'],
    // Legacy field mappings (for backward compatibility with old CSV files)
    parentPhone1: ['Parent Phone 1', 'parent_phone_number_1', 'Parent Phone', 'parent_phone', 'Guardian Phone', 'Phone 1', 'phone_1', 'Phone', 'Contact', 'PARENT PHONE 1'],
    parentPhone2: ['Parent Phone 2', 'parent_phone_number_2', 'Phone 2', 'phone_2', 'Alt Phone', 'Alternative Phone', 'PARENT PHONE 2'],
  };

  // Helper function for flexible CSV header matching
  const getColumnValue = (row: Record<string, string>, variations: string[]): string => {
    for (const variation of variations) {
      // Try exact match first
      if (row[variation] !== undefined) return row[variation];
      // Try case-insensitive match
      const key = Object.keys(row).find(k => k.toLowerCase().trim() === variation.toLowerCase().trim());
      if (key && row[key] !== undefined) return row[key];
    }
    return '';
  };

  // Download CSV template
  const downloadTemplate = () => {
    const headers = [
      'Name',
      'Admission Number',
      'Email',
      'Class',
      'Arm',
      'Date of Birth',
      'Address',
      'Status',
      'Father Name',
      'Father Phone',
      'Father Email',
      'Mother Name',
      'Mother Phone',
      'Mother Email'
    ];
    const sampleRow = [
      'John Doe',
      'ADM001',
      'john.doe@email.com',
      'JSS 1',
      'A',
      '2010-05-15',
      '123 Main Street',
      'Active',
      'Mr. John Doe Sr.',
      '08012345678',
      'father@email.com',
      'Mrs. Jane Doe',
      '08087654321',
      'mother@email.com'
    ];
    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'student_upload_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleCsvUpload = async () => {
    if (!uploadFile || !addToast) return;

    try {
      setIsUploading(true);
      
      const text = await uploadFile.text();
      const parsedCsv = parseCsv(text);
      
      if (parsedCsv.rows.length === 0) {
        addToast('CSV file is empty or invalid', 'error');
        setIsUploading(false);
        return;
      }

      // Get school_id and fetch existing admission numbers once before processing
      const supabase = requireSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Fetch all existing admission numbers for admission number generation
      const { data: existingStudents, error: fetchError } = await supabase
        .from('students')
        .select('admission_number')
        .eq('school_id', profile.school_id);
      
      const existingAdmissionNumbers = existingStudents
        ? existingStudents.map(s => s.admission_number).filter((num): num is string => !!num)
        : [];
      
      // Track generated numbers in this batch to avoid duplicates
      const generatedInBatch: string[] = [];

      // Process and validate student data
      const studentsToImport: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < parsedCsv.rows.length; i++) {
        const row = parsedCsv.rows[i];
        const rowNum = i + 2; // +2 because: +1 for header, +1 for 0-based index

        // Required field: Name
        const name = getColumnValue(row, CSV_HEADER_VARIATIONS.name);
        if (!name) {
          errors.push(`Row ${rowNum}: Name is required`);
          continue;
        }

        // Find class and arm by name if provided
        let class_id = null;
        let arm_id = null;
        
        const className = getColumnValue(row, CSV_HEADER_VARIATIONS.className);
        if (className) {
          const foundClass = allClasses.find(c => c.name.toLowerCase() === className.toLowerCase());
          if (foundClass) {
            class_id = foundClass.id;
          } else {
            errors.push(`Row ${rowNum}: Class "${className}" not found`);
          }
        }

        const armName = getColumnValue(row, CSV_HEADER_VARIATIONS.arm);
        if (armName) {
          const foundArm = allArms.find(a => a.name.toLowerCase() === armName.toLowerCase());
          if (foundArm) {
            arm_id = foundArm.id;
          } else {
            errors.push(`Row ${rowNum}: Arm "${armName}" not found`);
          }
        }

        // Extract all fields using flexible matching
        let admissionNumber = getColumnValue(row, CSV_HEADER_VARIATIONS.admissionNumber);
        
        // Generate admission number if not provided and class is available
        if (!admissionNumber && className) {
          try {
            const allExistingNumbers = [...existingAdmissionNumbers, ...generatedInBatch];
            const generated = generateAdmissionNumber(className, allExistingNumbers);
            if (generated) {
              admissionNumber = generated;
              generatedInBatch.push(generated);
            }
          } catch (err) {
            console.warn(`Row ${rowNum}: Failed to generate admission number:`, err);
          }
        }
        
        const email = getColumnValue(row, CSV_HEADER_VARIATIONS.email);
        const dateOfBirth = getColumnValue(row, CSV_HEADER_VARIATIONS.dob);
        const address = getColumnValue(row, CSV_HEADER_VARIATIONS.address);
        const status = getColumnValue(row, CSV_HEADER_VARIATIONS.status) || 'Active';
        
        // Parent contact information - canonical fields
        const fatherName = getColumnValue(row, CSV_HEADER_VARIATIONS.fatherName);
        const fatherPhone = getColumnValue(row, CSV_HEADER_VARIATIONS.fatherPhone);
        const fatherEmail = getColumnValue(row, CSV_HEADER_VARIATIONS.fatherEmail);
        const motherName = getColumnValue(row, CSV_HEADER_VARIATIONS.motherName);
        const motherPhone = getColumnValue(row, CSV_HEADER_VARIATIONS.motherPhone);
        const motherEmail = getColumnValue(row, CSV_HEADER_VARIATIONS.motherEmail);
        
        // Legacy field support (for backward compatibility)
        const legacyParentPhone1 = getColumnValue(row, CSV_HEADER_VARIATIONS.parentPhone1);
        const legacyParentPhone2 = getColumnValue(row, CSV_HEADER_VARIATIONS.parentPhone2);

        const studentData: any = {
          name,
          admission_number: admissionNumber,
          email: email,
          date_of_birth: dateOfBirth,
          address: address,
          status: status,
          class_id,
          arm_id,
          // Use specific parent fields, fall back to legacy fields if needed
          father_name: fatherName,
          father_phone: fatherPhone || legacyParentPhone1, // Fall back to legacy if specific field empty
          father_email: fatherEmail,
          mother_name: motherName,
          mother_phone: motherPhone || legacyParentPhone2, // Fall back to legacy if specific field empty
          mother_email: motherEmail,
        };

        studentsToImport.push(studentData);
      }

      if (errors.length > 0 && studentsToImport.length === 0) {
        addToast(`Upload failed: ${errors.join(', ')}`, 'error');
        setIsUploading(false);
        return;
      }

      // Import students with upsert logic
      let addedCount = 0;
      let updatedCount = 0;
      let failCount = 0;

      for (const studentData of studentsToImport) {
        try {
          let existingStudent: Student | undefined = undefined;
          
          // Attempt to match existing student if update is enabled
          if (updateExistingStudents && onUpdateStudent) {
            // Normalize search values once for performance
            const normalizedAdmissionNumber = studentData.admission_number?.trim().toLowerCase();
            const normalizedEmail = studentData.email?.trim().toLowerCase();
            
            // First, try to match by admission_number if provided and non-empty
            if (normalizedAdmissionNumber) {
              existingStudent = students.find(s => 
                s.admission_number?.trim().toLowerCase() === normalizedAdmissionNumber
              );
            }
            
            // If no match by admission_number, try matching by email
            if (!existingStudent && normalizedEmail) {
              existingStudent = students.find(s => 
                s.email?.trim().toLowerCase() === normalizedEmail
              );
            }
          }

          if (existingStudent) {
            // Update existing student
            // Note: Remove school_id to prevent changing the student's school assignment
            const { school_id, ...updateData } = studentData;
            const success = await onUpdateStudent(existingStudent.id, updateData);
            if (success) {
              updatedCount++;
            } else {
              failCount++;
            }
          } else {
            // Add new student
            const success = await onAddStudent({ ...studentData, school_id: profile.school_id });
            if (success) {
              addedCount++;
            } else {
              failCount++;
            }
          }
        } catch (err) {
          console.error('Error processing student:', err);
          failCount++;
        }
      }

      // Build success message with detailed summary
      const successParts: string[] = [];
      if (addedCount > 0) successParts.push(`${addedCount} student${addedCount !== 1 ? 's' : ''} added`);
      if (updatedCount > 0) successParts.push(`${updatedCount} student${updatedCount !== 1 ? 's' : ''} updated`);
      if (failCount > 0) successParts.push(`${failCount} failed`);
      if (errors.length > 0) successParts.push(`${errors.length} validation error${errors.length !== 1 ? 's' : ''}`);

      if (successParts.length > 0) {
        const messageType = (failCount > 0 || errors.length > 0) ? 'info' : 'success';
        const summaryMessage = successParts.join(', ');
        addToast(`Upload complete: ${summaryMessage}`, messageType);
      }

      setShowUploadModal(false);
      setUploadFile(null);
      
    } catch (error: any) {
      console.error('CSV upload error:', error);
      addToast?.(`Upload failed: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleExportStudentsExcel = () => {
      const columns: ExcelColumn[] = [
          { key: 'name', header: 'Name', width: 25, type: 'string' },
          { key: 'admission_number', header: 'Admission Number', width: 18, type: 'string' },
          { key: 'email', header: 'Email/Username', width: 30, type: 'string' },
          { key: 'class', header: 'Class', width: 15, type: 'string' },
          { key: 'arm', header: 'Arm', width: 10, type: 'string' },
          { key: 'status', header: 'Status', width: 18, type: 'string' },
          { key: 'has_account', header: 'Has Account', width: 12, type: 'string' },
          { key: 'date_of_birth', header: 'Date of Birth', width: 15, type: 'date' },
          { key: 'guardian_phone', header: 'Guardian Contact', width: 20, type: 'string' },
          { key: 'address', header: 'Address', width: 35, type: 'string' },
      ];

      const dataToExport = filteredStudents.map(s => ({
          name: s.name,
          admission_number: s.admission_number || '',
          email: s.email || '',
          class: s.class?.name || '',
          arm: s.arm?.name || '',
          status: s.status || '',
          has_account: s.user_id ? 'Yes' : 'No',
          date_of_birth: s.date_of_birth || '',
          guardian_phone: s.guardian_phone || '',
          address: s.address || ''
      }));

      exportToExcel(dataToExport, columns, {
          filename: 'students_export',
          sheetName: 'Students',
          includeTimestamp: true
      });
  };

  const commonInputClasses = "w-full p-3 min-h-touch text-base border rounded-md bg-white/50 dark:bg-slate-800/50 border-slate-300/60 dark:border-slate-700/60 focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Student Roster</h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1">Manage all students in the school.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ℹ️ Passwords are only shown once during account creation. Students use their username to login.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button 
                onClick={handleGenerateAwards}
                disabled={isGeneratingAwards}
                className="touch-target text-sm bg-amber-500 text-white px-4 rounded-lg hover:bg-amber-600 disabled:bg-amber-400 flex items-center justify-center min-w-[150px]"
            >
                {isGeneratingAwards ? <Spinner size="sm" /> : '✨ Generate Awards'}
            </button>
            {canManageStudents && <button onClick={onOpenCreateStudentAccountModal} className="touch-target px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 text-sm">Create Account</button>}
            {canManageStudents && <button onClick={() => setIsAddModalOpen(true)} className="touch-target px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm">Add Student</button>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <input type="text" placeholder="Search by name or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={commonInputClasses} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={commonInputClasses}>
              <option value="">All Statuses</option>
              {STUDENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className={commonInputClasses}>
              <option value="">All Classes</option>
              {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={loginFilter} onChange={e => setLoginFilter(e.target.value)} className={commonInputClasses}>
              <option value="">All Accounts</option>
              <option value="missing">Missing Login</option>
          </select>
          <div className="flex gap-2">
            <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} className={commonInputClasses + " flex-1"}>
                <option value="">All Teachers</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={() => setShowExportModal(true)} className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1" title="Export Students">
                <DownloadIcon className="w-4 h-4" />
                <span className="text-xs">Export</span>
            </button>
            {canManageStudents && (
              <button onClick={() => setShowUploadModal(true)} className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1" title="Upload Students CSV">
                  <UploadCloudIcon className="w-4 h-4" />
                  <span className="text-xs">Upload</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Bulk Actions Bar */}
        {canManageStudents && selectedIds.size > 0 && (
             <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300 ml-2">{selectedIds.size} students selected</span>
                <div className="flex gap-2">
                    {onBulkDeleteStudents && (
                        <button
                            onClick={handleBulkDeleteStudentsClick}
                            disabled={isDeletingStudents}
                            className="px-4 py-1.5 bg-red-900 text-white text-sm font-bold rounded-md hover:bg-red-950 disabled:opacity-50 flex items-center gap-2"
                            title="Permanently delete selected students and all their data"
                        >
                            {isDeletingStudents ? <Spinner size="sm"/> : <><TrashIcon className="w-4 h-4" /> Delete Students</>}
                        </button>
                    )}
                     <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-md">Cancel</button>
                </div>
            </div>
        )}

        {/* Items per page selector */}
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Show</span>
                <select 
                    value={itemsPerPage} 
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="p-1.5 text-sm border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                </select>
                <span className="text-sm text-slate-600 dark:text-slate-400">entries</span>
            </div>
            <span className="text-sm text-slate-500">{filteredStudents.length} students found</span>
        </div>

        <div className="table-scroll-wrapper min-h-[400px]">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-500/10 sticky top-0 z-10">
              <tr>
                {canManageStudents && (
                    <th scope="col" className="px-6 py-3 w-4">
                        <input type="checkbox" onChange={handleSelectAllVisible} checked={isAllVisibleSelected} />
                    </th>
                )}
                <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 select-none" onClick={() => handleSort('name')}>
                    Student Name <SortIcon field="name" />
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 select-none" onClick={() => handleSort('admission_number')}>
                    Admission No. <SortIcon field="admission_number" />
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 select-none" onClick={() => handleSort('class')}>
                    Class <SortIcon field="class" />
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 select-none" onClick={() => handleSort('status')}>
                    Status <SortIcon field="status" />
                </th>
                <th scope="col" className="px-6 py-3">Username</th>
                <th scope="col" className="px-6 py-3">Account</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map(student => {
                const statusValue = student.status || 'Unknown'; // Ensure not null
                const statusInfo = STUDENT_STATUSES.find(s => s.value === statusValue) || { label: statusValue, color: 'bg-slate-500/20 text-slate-700 dark:text-slate-300' };
                // Extract username from email by removing @upsshub.com
                const displayUsername = student.email ? student.email.replace('@upsshub.com', '') : null;
                return (
                    <tr key={student.id} className="border-b border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-500/10">
                        {canManageStudents && (
                            <td className="px-6 py-4">
                                <input type="checkbox" checked={selectedIds.has(student.id)} onChange={() => handleSelectOne(student.id)} />
                            </td>
                        )}
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{student.name}</td>
                        <td className="px-6 py-4 font-mono text-xs">{student.admission_number}</td>
                        <td className="px-6 py-4">{student.class?.name}{student.arm?.name ? ` - ${student.arm.name}` : ''}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>{statusInfo.label}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono">
                            {displayUsername ? (
                                <span className="text-slate-600 dark:text-slate-300" title="Login Username">{displayUsername}</span>
                            ) : (
                                <span className="text-slate-400 dark:text-slate-500">Not set</span>
                            )}
                        </td>
                         <td className="px-6 py-4">
                            {student.user_id ? (
                                <span className="text-green-600 text-xs font-bold flex items-center gap-1">Active</span>
                            ) : (
                                <span className="text-red-500 text-xs font-bold">Missing</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => onAddPositive(student)} title="Log Positive Behavior" className="p-1.5 rounded-full text-green-600 hover:bg-green-500/10 transition-colors">
                            <PlusCircleIcon className="w-5 h-5"/>
                        </button>
                        <button onClick={() => onViewStudent(student)} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">View Profile</button>
                        </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
           {filteredStudents.length === 0 && (
            <div className="text-center py-8 text-slate-500">
                No students match your criteria.
            </div>
           )}
        </div>
        
        <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
            itemsPerPage={itemsPerPage}
            totalItems={filteredStudents.length}
        />
      </div>

      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddStudent={handleAddStudent}
        allClasses={allClasses}
        allArms={allArms}
      />

      {/* Export Configuration Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
          <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-3xl m-4 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Export Students</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-grow overflow-y-auto">
              {/* Export Scope */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Export Scope</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <input
                      type="radio"
                      checked={!exportSelectedOnly}
                      onChange={() => setExportSelectedOnly(false)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Export all filtered students ({filteredStudents.length} students)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <input
                      type="radio"
                      checked={exportSelectedOnly}
                      onChange={() => setExportSelectedOnly(true)}
                      disabled={selectedIds.size === 0}
                      className="w-4 h-4 disabled:opacity-50"
                    />
                    <span className={`text-sm ${selectedIds.size === 0 ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                      Export only selected students ({selectedIds.size} selected)
                    </span>
                  </label>
                </div>
              </div>

              {/* Field Selection */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Fields to Export</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllFields}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Select All
                    </button>
                    <span className="text-slate-400">|</span>
                    <button
                      onClick={deselectAllFields}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg">
                  {availableFields.map(field => (
                    <label key={field.key} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFields.has(field.key)}
                        onChange={() => toggleField(field.key)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{field.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex-shrink-0 flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExportWithOptions('csv')}
                className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 flex items-center gap-2"
              >
                <DownloadIcon className="w-5 h-5" />
                Export as CSV
              </button>
              <button
                onClick={() => handleExportWithOptions('excel')}
                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <DownloadIcon className="w-5 h-5" />
                Export as Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
          <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-2xl m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Upload Students from CSV</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                }}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    Upload a CSV file to add new students or update existing ones. The system will match by admission number or email. Not sure about the format?
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Download Template CSV
                  </button>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Supported Columns:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-blue-700 dark:text-blue-400">
                  <div>• Name (required)</div>
                  <div>• Admission Number</div>
                  <div>• Email/Username</div>
                  <div>• Class</div>
                  <div>• Arm</div>
                  <div>• Date of Birth</div>
                  <div>• Address</div>
                  <div>• Status</div>
                  <div>• Parent Phone 1</div>
                  <div>• Parent Phone 2</div>
                  <div>• Guardian Contact</div>
                  <div>• Father Name</div>
                  <div>• Mother Name</div>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  ℹ️ Flexible headers: The system accepts various column name formats (e.g., "Student Name", "student_name", "NAME")
                </p>
              </div>
              
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
                ⚠️ Note: Class and Arm names must match existing values in the system
              </p>

              {/* Update existing students checkbox */}
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExistingStudents}
                  onChange={(e) => setUpdateExistingStudents(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                />
                <span className="font-semibold">Update existing students</span>
                <span className="text-xs text-slate-500">(matches by admission number or email)</span>
              </label>
            </div>

            <div className="mb-6">
              <label className="block">
                <div className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  uploadFile 
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20' 
                    : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500'
                }`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <UploadCloudIcon className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  {uploadFile ? (
                    <>
                      <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                        {uploadFile.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Click to change file
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        CSV files only
                      </p>
                    </>
                  )}
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                }}
                className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30"
              >
                Cancel
              </button>
              <button
                onClick={handleCsvUpload}
                disabled={!uploadFile || isUploading}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Spinner size="sm" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloudIcon className="w-5 h-5" />
                    Upload Students
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentListView;
