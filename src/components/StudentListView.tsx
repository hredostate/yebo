import type { SmsResult } from '../services/activationLinks';

import React, { useState, useMemo, useRef } from 'react';
import type { Student, UserProfile, BaseDataObject, TeachingAssignment, CreatedCredential } from '../types';
import AddStudentModal from './AddStudentModal';
import { PlusCircleIcon, DownloadIcon, TrashIcon, UploadCloudIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS, STUDENT_STATUSES } from '../constants';
import { exportToCsv } from '../utils/export';
import { exportToExcel, type ExcelColumn } from '../utils/excelExport';
import Pagination from './common/Pagination';
import { isActiveEmployee } from '../utils/userHelpers';
import { type ActivationLinkResult } from '../services/activationLinks';
import { parseCsv } from '../utils/feesCsvUtils';
import { generateAdmissionNumber } from '../utils/admissionNumber';
import { requireSupabaseClient } from '../services/supabaseClient';

interface StudentListViewProps {
  students: Student[];
  onAddStudent: (studentData: any) => Promise<boolean>;
  onViewStudent: (student: Student) => void;
  onAddPositive: (student: Student) => void;
  onGenerateStudentAwards: () => Promise<void>;
  userPermissions: string[];
  onOpenCreateStudentAccountModal: () => void;
  allClasses: BaseDataObject[];
  allArms: BaseDataObject[];
  users: UserProfile[];
  teachingAssignments: TeachingAssignment[];
  onBulkCreateStudentAccounts: (studentIds: number[]) => Promise<{ success: boolean; message: string; credentials?: CreatedCredential[] }>;
  onBulkResetStrikes?: () => Promise<void>;
  onBulkDeleteAccounts?: (userIds: string[]) => Promise<{ success: boolean; deleted: number; total: number }>;
  onBulkRetrievePasswords?: (studentIds: number[]) => Promise<{ success: boolean; credentials?: CreatedCredential[] }>;
  onDeleteStudent?: (studentId: number) => Promise<boolean>;
  onBulkDeleteStudents?: (studentIds: number[]) => Promise<{ success: boolean; deleted: number; total: number }>;
  onGenerateActivationLinks?: (
    studentIds: number[],
    options: { expiryHours: number; phoneField: 'parent_phone_number_1' | 'parent_phone_number_2' | 'student_phone'; template: string; sendSms?: boolean }
  ) => Promise<{ success: boolean; results: ActivationLinkResult[]; expires_at: string; sms_results?: SmsResult[] }>;
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// Simple modal to show credentials after bulk generation
const CredentialsModal: React.FC<{ results: CreatedCredential[]; onClose: () => void }> = ({ results, onClose }) => {
    const handleExport = () => {
        exportToCsv(results, 'new_student_credentials.csv');
    };
    
    // Calculate messaging stats
    const messagingStats = results.reduce((acc, res: any) => {
        if (res.messagingResults && Array.isArray(res.messagingResults)) {
            res.messagingResults.forEach((msg: any) => {
                if (msg.success) {
                    acc.sent++;
                } else {
                    acc.failed++;
                }
            });
        } else if (res.status === 'Success') {
            // If no messaging results, student might not have phone numbers
            acc.noPhone++;
        }
        return acc;
    }, { sent: 0, failed: 0, noPhone: 0 });
    
    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-4xl m-4 flex flex-col max-h-[90vh]">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Generated Credentials</h2>
                <div className="my-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                    <p className="font-bold">Important</p>
                    <p className="text-sm mt-1">Please export these credentials now. Passwords will not be shown again.</p>
                </div>
                
                {/* Messaging Summary */}
                {(messagingStats.sent > 0 || messagingStats.failed > 0) && (
                    <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 dark:bg-blue-900/20 dark:border-blue-400">
                        <p className="font-semibold text-blue-800 dark:text-blue-300">Messaging Summary</p>
                        <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                            {messagingStats.sent > 0 && `✓ ${messagingStats.sent} message(s) sent successfully`}
                            {messagingStats.sent > 0 && messagingStats.failed > 0 && ' | '}
                            {messagingStats.failed > 0 && `✗ ${messagingStats.failed} message(s) failed`}
                            {messagingStats.noPhone > 0 && ` | ℹ ${messagingStats.noPhone} student(s) without phone numbers`}
                        </p>
                    </div>
                )}
                
                <div className="flex-grow my-4 overflow-y-auto border-y border-slate-200/60 dark:border-slate-700/60">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-500/10 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Name</th>
                                <th className="px-4 py-2">Email</th>
                                <th className="px-4 py-2">Password</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2">Messaging</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((res: any, index) => {
                                const msgResults = res.messagingResults || [];
                                const sentCount = msgResults.filter((m: any) => m.success).length;
                                const failCount = msgResults.length - sentCount;
                                
                                return (
                                    <tr key={index} className="border-b border-slate-200/60 dark:border-slate-700/60">
                                        <td className="px-4 py-2 font-medium">{res.name}</td>
                                        <td className="px-4 py-2">{res.email}</td>
                                        <td className="px-4 py-2 font-mono">{res.password || 'N/A'}</td>
                                        <td className="px-4 py-2">{res.status}</td>
                                        <td className="px-4 py-2">
                                            {msgResults.length === 0 ? (
                                                <span className="text-gray-500 text-xs">No phone</span>
                                            ) : (
                                                <span className="text-xs">
                                                    {sentCount > 0 && <span className="text-green-600 dark:text-green-400">✓ {sentCount}</span>}
                                                    {sentCount > 0 && failCount > 0 && ' / '}
                                                    {failCount > 0 && <span className="text-red-600 dark:text-red-400">✗ {failCount}</span>}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="flex-shrink-0 flex justify-end gap-4">
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                        <DownloadIcon className="w-5 h-5" /> Export CSV
                    </button>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30">Close</button>
                </div>
            </div>
        </div>
    );
};

const StudentListView: React.FC<StudentListViewProps> = ({
    students, onAddStudent, onViewStudent, onAddPositive, onGenerateStudentAwards, userPermissions,
    onOpenCreateStudentAccountModal, allClasses, allArms, users, teachingAssignments, onBulkCreateStudentAccounts, onBulkResetStrikes, onBulkDeleteAccounts, onBulkRetrievePasswords, onDeleteStudent, onBulkDeleteStudents, addToast,
    onGenerateActivationLinks
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [loginFilter, setLoginFilter] = useState(''); // 'missing' or ''
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGeneratingAwards, setIsGeneratingAwards] = useState(false);
  const [isDeletingAccounts, setIsDeletingAccounts] = useState(false);
  const [isRetrievingPasswords, setIsRetrievingPasswords] = useState(false);
  const [isDeletingStudents, setIsDeletingStudents] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Sorting State
  const [sortField, setSortField] = useState<'name' | 'admission_number' | 'class' | 'status'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isGeneratingLogins, setIsGeneratingLogins] = useState(false);
  const [credentials, setCredentials] = useState<CreatedCredential[] | null>(null);
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [activationExpiryHours, setActivationExpiryHours] = useState(72);
  const [activationPhoneField, setActivationPhoneField] = useState<'parent_phone_number_1' | 'parent_phone_number_2' | 'student_phone'>('parent_phone_number_1');
  const [activationTemplate, setActivationTemplate] = useState(
    'Hello {parent_or_student_name}. This is {school_name}. {student_name} ({class_arm}) can activate their portal account using this link: {activation_link}. Username: {username}. Link expires {expires_at}. Thank you.'
  );
  const [activationResults, setActivationResults] = useState<ActivationLinkResult[] | null>(null);
  const [activationExpiresAt, setActivationExpiresAt] = useState<string | null>(null);
  const [isGeneratingActivationLinks, setIsGeneratingActivationLinks] = useState(false);
  const [sendSmsEnabled, setSendSmsEnabled] = useState(true);
  const [smsResults, setSmsResults] = useState<SmsResult[] | null>(null);

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
  
  const handleBulkCreateAccounts = async () => {
      if (selectedIds.size === 0) return;
      if (!window.confirm(`Generate login credentials for ${selectedIds.size} students?`)) return;
      
      setIsGeneratingLogins(true);
      const { success, credentials: creds } = await onBulkCreateStudentAccounts(Array.from(selectedIds));
      setIsGeneratingLogins(false);
      
      if (success && creds) {
          setCredentials(creds);
          setSelectedIds(new Set()); // Clear selection
      }
  };

  const normalizeNigerianNumber = (phone?: string | null) => {
      if (!phone) return { normalized: '', valid: false, reason: 'Missing number' };
      const digits = phone.replace(/\D/g, '');
      if (!digits) return { normalized: '', valid: false, reason: 'Missing number' };

      let normalized = digits;
      if (digits.startsWith('0')) {
          normalized = `+234${digits.slice(1)}`;
      } else if (digits.startsWith('234')) {
          normalized = `+${digits}`;
      } else if (!digits.startsWith('234') && !digits.startsWith('2340')) {
          normalized = `+234${digits}`;
      }

      const numericLength = normalized.replace(/\D/g, '').length;
      const valid = normalized.startsWith('+234') && numericLength === 13;
      return { normalized, valid, reason: valid ? '' : 'Invalid length' };
  };

  const buildMessageFromTemplate = (template: string, row: ActivationLinkResult, phone: string) => {
      const classArm = [row.class_name, row.arm_name].filter(Boolean).join(' ');
      return template
          .replace('{parent_or_student_name}', row.student_name || 'Parent/Guardian')
          .replace('{student_name}', row.student_name || 'Student')
          .replace('{class_arm}', classArm || 'their class')
          .replace('{activation_link}', row.activation_link || '')
          .replace('{username}', row.username || row.admission_number || '')
          .replace('{expires_at}', activationExpiresAt ? new Date(activationExpiresAt).toLocaleString() : '')
          .replace('{school_name}', 'UPSS')
          .replace('{recipient_phone}', phone);
  };

  const handleGenerateActivationLinks = async () => {
      if (!onGenerateActivationLinks) return;
      if (selectedIds.size === 0) {
          alert('Select at least one student to generate activation links.');
          return;
      }

      setIsGeneratingActivationLinks(true);
      try {
          const response = await onGenerateActivationLinks(Array.from(selectedIds), {
              expiryHours: activationExpiryHours,
              phoneField: activationPhoneField,
              template: activationTemplate,
              sendSms: sendSmsEnabled,
          });
          if (response.success) {
              setActivationResults(response.results || []);
              setActivationExpiresAt(response.expires_at || null);
              setSmsResults(response.sms_results || null);
              
              // Show success notification if SMS was sent
              if (sendSmsEnabled && response.sms_results && addToast) {
                  const successCount = response.sms_results.filter((r: SmsResult) => r.success).length;
                  const failCount = response.sms_results.filter((r: SmsResult) => !r.success).length;
                  if (successCount > 0) {
                      addToast(`${successCount} SMS message(s) sent successfully${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
                  } else if (failCount > 0) {
                      addToast(`Failed to send ${failCount} SMS message(s)`, 'error');
                  }
              }
          }
      } catch (e: any) {
          alert(e.message || 'Unable to generate activation links');
      } finally {
          setIsGeneratingActivationLinks(false);
      }
  };

  const handleExportActivationCsv = () => {
      if (!activationResults) return;
      const rows = activationResults
          .filter(r => r.status === 'created' && r.activation_link)
          .map(r => {
              const rawPhone = activationPhoneField === 'parent_phone_number_2'
                  ? r.phone_2
                  : activationPhoneField === 'student_phone'
                      ? r.student_phone
                      : r.phone_1;
              const { normalized, valid, reason } = normalizeNigerianNumber(rawPhone || undefined);
              return {
                  student_name: r.student_name || '',
                  admission_number: r.admission_number || '',
                  username: r.username || r.admission_number || '',
                  class_name: r.class_name || '',
                  arm_name: r.arm_name || '',
                  recipient_phone: normalized || rawPhone || '',
                  activation_link: r.activation_link || '',
                  expires_at: r.expires_at || activationExpiresAt || '',
                  phone_status: valid ? 'valid' : `invalid${reason ? `: ${reason}` : ''}`,
              };
          });

      exportToCsv(rows, 'activation_links_whatsapp.csv');
  };

  const handleBulkDeleteAccounts = async () => {
      if (!onBulkDeleteAccounts) return;
      
      // Get user_ids from selected students that have accounts
      const selectedStudentsWithAccounts = students.filter(s => selectedIds.has(s.id) && s.user_id);
      const userIds = selectedStudentsWithAccounts.map(s => s.user_id!);
      
      if (userIds.length === 0) {
          alert('None of the selected students have login accounts to delete.');
          return;
      }
      
      if (!window.confirm(`WARNING: You are about to DELETE ${userIds.length} login accounts. This action cannot be undone!\n\nThe affected students will no longer be able to log in.`)) {
          return;
      }
      
      // Double confirmation
      if (!window.confirm(`FINAL WARNING: Are you absolutely sure you want to delete ${userIds.length} accounts?`)) {
          return;
      }
      
      setIsDeletingAccounts(true);
      await onBulkDeleteAccounts(userIds);
      setIsDeletingAccounts(false);
      setSelectedIds(new Set()); // Clear selection
  };

  const handleBulkRetrievePasswords = async () => {
      if (!onBulkRetrievePasswords) return;
      
      // Get students with accounts
      const selectedStudentsWithAccounts = students.filter(s => selectedIds.has(s.id) && s.user_id);
      
      if (selectedStudentsWithAccounts.length === 0) {
          alert('None of the selected students have login accounts.');
          return;
      }
      
      if (!window.confirm(`Retrieve passwords for ${selectedStudentsWithAccounts.length} students?`)) {
          return;
      }
      
      setIsRetrievingPasswords(true);
      const { success, credentials: creds } = await onBulkRetrievePasswords(selectedStudentsWithAccounts.map(s => s.id));
      setIsRetrievingPasswords(false);
      
      if (success && creds) {
          setCredentials(creds);
          setSelectedIds(new Set()); // Clear selection
      }
  };

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
    { key: 'guardian_phone', label: 'Guardian Contact', header: 'Guardian Contact' },
    { key: 'address', label: 'Address', header: 'Address' },
    { key: 'parent_phone_number_1', label: 'Parent Phone 1', header: 'Parent Phone 1' },
    { key: 'parent_phone_number_2', label: 'Parent Phone 2', header: 'Parent Phone 2' },
    { key: 'father_name', label: 'Father Name', header: 'Father Name' },
    { key: 'mother_name', label: 'Mother Name', header: 'Mother Name' },
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
      guardian_phone: (s) => s.guardian_phone || '',
      address: (s) => s.address || '',
      parent_phone_number_1: (s) => s.parent_phone_number_1 || '',
      parent_phone_number_2: (s) => s.parent_phone_number_2 || '',
      father_name: (s) => s.father_name || '',
      mother_name: (s) => s.mother_name || '',
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
    parentPhone1: ['Parent Phone 1', 'parent_phone_number_1', 'Parent Phone', 'parent_phone', 'Guardian Phone', 'Phone 1', 'phone_1', 'Phone', 'Contact', 'PARENT PHONE 1'],
    parentPhone2: ['Parent Phone 2', 'parent_phone_number_2', 'Phone 2', 'phone_2', 'Alt Phone', 'Alternative Phone', 'PARENT PHONE 2'],
    guardianContact: ['Guardian Contact', 'guardian_phone', 'Guardian Phone', 'guardian_contact', 'Emergency Contact', 'GUARDIAN CONTACT'],
    fatherName: ['Father Name', 'father_name', 'Father', 'Dad Name', 'FATHER NAME', "Father's Name"],
    motherName: ['Mother Name', 'mother_name', 'Mother', 'Mom Name', 'MOTHER NAME', "Mother's Name"]
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
      'Parent Phone 1',
      'Parent Phone 2',
      'Father Name',
      'Mother Name'
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
      '08012345678',
      '08087654321',
      'Mr. Doe',
      'Mrs. Doe'
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
        const parentPhone1 = getColumnValue(row, CSV_HEADER_VARIATIONS.parentPhone1);
        const parentPhone2 = getColumnValue(row, CSV_HEADER_VARIATIONS.parentPhone2);
        const guardianContact = getColumnValue(row, CSV_HEADER_VARIATIONS.guardianContact);
        const fatherName = getColumnValue(row, CSV_HEADER_VARIATIONS.fatherName);
        const motherName = getColumnValue(row, CSV_HEADER_VARIATIONS.motherName);

        const studentData: any = {
          name,
          admission_number: admissionNumber,
          email: email,
          date_of_birth: dateOfBirth,
          address: address,
          status: status,
          class_id,
          arm_id,
          parent_phone_number_1: parentPhone1,
          parent_phone_number_2: parentPhone2,
          father_name: fatherName,
          mother_name: motherName,
          // Use guardian contact if provided, otherwise fall back to parent phone 1
          guardian_phone: guardianContact || parentPhone1,
        };

        studentsToImport.push(studentData);
      }

      if (errors.length > 0 && studentsToImport.length === 0) {
        addToast(`Upload failed: ${errors.join(', ')}`, 'error');
        setIsUploading(false);
        return;
      }

      // Import students
      let successCount = 0;
      let failCount = 0;

      for (const studentData of studentsToImport) {
        try {
          const success = await onAddStudent({ ...studentData, school_id: profile.school_id });
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error('Error adding student:', err);
          failCount++;
        }
      }

      if (errors.length > 0) {
        addToast(`Partial upload: ${successCount} students added, ${failCount} failed, ${errors.length} validation errors`, 'info');
      } else if (successCount > 0) {
        addToast(`Successfully imported ${successCount} student${successCount !== 1 ? 's' : ''}!`, 'success');
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
            ℹ️ Passwords are only shown once during account creation. Students use their email/username to login.
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
                    <button 
                        onClick={handleBulkCreateAccounts} 
                        disabled={isGeneratingLogins || isDeletingAccounts || isRetrievingPasswords || isDeletingStudents}
                        className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isGeneratingLogins ? <Spinner size="sm"/> : 'Generate Logins'}
                    </button>
                    {onBulkRetrievePasswords && (
                        <button 
                            onClick={handleBulkRetrievePasswords} 
                            disabled={isGeneratingLogins || isDeletingAccounts || isRetrievingPasswords || isDeletingStudents}
                            className="px-4 py-1.5 bg-amber-600 text-white text-sm font-bold rounded-md hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
                            title="Retrieve passwords for selected students"
                        >
                            {isRetrievingPasswords ? <Spinner size="sm"/> : 'Retrieve Passwords'}
                        </button>
                    )}
                    {onBulkDeleteAccounts && (
                        <button
                            onClick={handleBulkDeleteAccounts}
                            disabled={isGeneratingLogins || isDeletingAccounts || isRetrievingPasswords || isDeletingStudents}
                            className="px-4 py-1.5 bg-red-700 text-white text-sm font-bold rounded-md hover:bg-red-800 disabled:opacity-50 flex items-center gap-2"
                            title="Delete login accounts for selected students"
                        >
                            {isDeletingAccounts ? <Spinner size="sm"/> : 'Delete Accounts'}
                        </button>
                    )}
                    {onGenerateActivationLinks && (
                        <button
                            onClick={() => setIsActivationModalOpen(true)}
                            disabled={isGeneratingLogins || isDeletingAccounts || isRetrievingPasswords || isDeletingStudents}
                            className="px-4 py-1.5 bg-emerald-700 text-white text-sm font-bold rounded-md hover:bg-emerald-800 disabled:opacity-50 flex items-center gap-2"
                            title="Generate one-time activation links for WhatsApp distribution"
                        >
                            Generate WhatsApp Activation Links
                        </button>
                    )}
                    {onBulkDeleteStudents && (
                        <button
                            onClick={handleBulkDeleteStudentsClick}
                            disabled={isGeneratingLogins || isDeletingAccounts || isRetrievingPasswords || isDeletingStudents}
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
                <th scope="col" className="px-6 py-3">Email/Username</th>
                <th scope="col" className="px-6 py-3">Account</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map(student => {
                const statusValue = student.status || 'Unknown'; // Ensure not null
                const statusInfo = STUDENT_STATUSES.find(s => s.value === statusValue) || { label: statusValue, color: 'bg-slate-500/20 text-slate-700 dark:text-slate-300' };
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
                            {student.email ? (
                                <span className="text-slate-600 dark:text-slate-300" title="Login Email">{student.email}</span>
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

      {isActivationModalOpen && onGenerateActivationLinks && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
              <div className="rounded-2xl border border-slate-200/60 bg-white/90 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/90 w-full max-w-5xl m-4 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-start gap-4">
                      <div>
                          <h2 className="text-xl font-bold text-slate-800 dark:text-white">WhatsApp Activation Links</h2>
                          <p className="text-sm text-slate-600 dark:text-slate-300">Links are one-time, time-limited, and should be sent privately.</p>
                      </div>
                      <button onClick={() => setIsActivationModalOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white">Close</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <label className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Expiry
                          <select value={activationExpiryHours} onChange={e => setActivationExpiryHours(Number(e.target.value))} className="mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                              <option value={24}>24 hours</option>
                              <option value={48}>48 hours</option>
                              <option value={72}>72 hours</option>
                          </select>
                      </label>
                      <label className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Recipient phone
                          <select value={activationPhoneField} onChange={e => setActivationPhoneField(e.target.value as any)} className="mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                              <option value="parent_phone_number_1">Parent phone 1</option>
                              <option value="parent_phone_number_2">Parent phone 2</option>
                              <option value="student_phone">Student phone (if available)</option>
                          </select>
                      </label>
                      <div className="bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 rounded-md border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm">
                          <p className="font-semibold">Safety notes</p>
                          <ul className="list-disc ml-4 space-y-1">
                              <li>Links are single use and expire.</li>
                              <li>Send privately, not to group chats.</li>
                              <li>Passwords are never shown or exported.</li>
                          </ul>
                      </div>
                  </div>

                  <label className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-200 mt-4">
                      Message template
                      <textarea
                          className="mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[100px]"
                          value={activationTemplate}
                          onChange={e => setActivationTemplate(e.target.value)}
                      />
                      <span className="text-xs text-slate-500 mt-1">Placeholders: {'{parent_or_student_name}'}, {'{student_name}'}, {'{class_arm}'}, {'{activation_link}'}, {'{username}'}, {'{expires_at}'}, {'{school_name}'}</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mt-4">
                      <input
                          type="checkbox"
                          checked={sendSmsEnabled}
                          onChange={e => setSendSmsEnabled(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                      />
                      <span>Send activation links via SMS</span>
                      <span className="text-xs font-normal text-slate-500">(Messages will be sent automatically)</span>
                  </label>

                  <div className="flex items-center gap-3 mt-4">
                      <button
                          onClick={handleGenerateActivationLinks}
                          disabled={isGeneratingActivationLinks}
                          className="px-4 py-2 bg-emerald-700 text-white rounded-md font-semibold hover:bg-emerald-800 disabled:opacity-50 flex items-center gap-2"
                      >
                          {isGeneratingActivationLinks ? <Spinner size="sm" /> : 'Generate links'}
                      </button>
                      <button
                          onClick={handleExportActivationCsv}
                          disabled={!activationResults || activationResults.length === 0}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                      >
                          <DownloadIcon className="w-4 h-4" /> Export CSV
                      </button>
                  </div>

                  {activationResults && (
                      <div className="mt-4 space-y-3 overflow-y-auto">
                           <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-200">
                              <span className="font-semibold">Summary:</span>
                              <span>{activationResults.filter(r => r.status === 'created').length} links created</span>
                              <span>{activationResults.filter(r => r.status === 'error').length} errors</span>
                              <span>{activationResults.filter(r => r.status === 'skipped').length} skipped</span>
                              {smsResults && smsResults.length > 0 && (
                                  <>
                                      <span className="text-green-600 dark:text-green-400">✓ {smsResults.filter(r => r.success).length} SMS sent</span>
                                      {smsResults.filter(r => !r.success).length > 0 && (
                                          <span className="text-red-600 dark:text-red-400">✗ {smsResults.filter(r => !r.success).length} SMS failed</span>
                                      )}
                                  </>
                              )}
                              {activationExpiresAt && <span>Expires: {new Date(activationExpiresAt).toLocaleString()}</span>}
                          </div>
                          <div className="text-xs text-slate-500">Phone numbers are normalized to +234 format when exporting.</div>
                          <div className="border border-slate-200 dark:border-slate-700 rounded-md max-h-[320px] overflow-y-auto">
                              <table className="w-full text-sm">
                                  <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase">
                                      <tr>
                                          <th className="px-3 py-2">Student</th>
                                          <th className="px-3 py-2">Phone</th>
                                          <th className="px-3 py-2">Link Status</th>
                                          {smsResults && smsResults.length > 0 && <th className="px-3 py-2">SMS Status</th>}
                                          <th className="px-3 py-2">Actions</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {activationResults.map((r, idx) => {
                                          const rawPhone = activationPhoneField === 'parent_phone_number_2'
                                              ? r.phone_2
                                              : activationPhoneField === 'student_phone'
                                                  ? r.student_phone
                                                  : r.phone_1;
                                          const { normalized, valid, reason } = normalizeNigerianNumber(rawPhone || undefined);
                                          const displayPhone = normalized || rawPhone || 'Missing';
                                          const message = r.activation_link ? buildMessageFromTemplate(activationTemplate, r, displayPhone) : '';
                                          const smsResult = smsResults?.find(s => s.student_id === r.student_id);
                                          return (
                                              <tr key={`${r.student_id}-${idx}`} className="border-t border-slate-200 dark:border-slate-700">
                                                  <td className="px-3 py-2">
                                                      <div className="font-semibold">{r.student_name || 'Unknown'}</div>
                                                      <div className="text-xs text-slate-500">{[r.class_name, r.arm_name].filter(Boolean).join(' ')}</div>
                                                  </td>
                                                  <td className="px-3 py-2">
                                                      <div>{displayPhone}</div>
                                                      {!valid && <div className="text-xs text-red-600">{reason || 'Invalid phone'}</div>}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{r.status}</span>
                                                  </td>
                                                  {smsResults && smsResults.length > 0 && (
                                                      <td className="px-3 py-2">
                                                          {smsResult ? (
                                                              smsResult.success ? (
                                                                  <span className="text-green-600 dark:text-green-400 text-xs">✓ Sent</span>
                                                              ) : (
                                                                  <span className="text-red-600 dark:text-red-400 text-xs" title={smsResult.error}>✗ Failed</span>
                                                              )
                                                          ) : (
                                                              <span className="text-slate-400 text-xs">-</span>
                                                          )}
                                                      </td>
                                                  )}
                                                  <td className="px-3 py-2 space-x-2">
                                                      {r.activation_link && (
                                                          <button
                                                              className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md"
                                                              onClick={() => navigator.clipboard.writeText(message)}
                                                          >
                                                              Copy message
                                                          </button>
                                                      )}
                                                  </td>
                                              </tr>
                                          );
                                      })}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddStudent={handleAddStudent}
        allClasses={allClasses}
        allArms={allArms}
      />

      {credentials && <CredentialsModal results={credentials} onClose={() => setCredentials(null)} />}

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
                    Upload a CSV file containing student information. Not sure about the format?
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
              
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Note: Class and Arm names must match existing values in the system
              </p>
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
