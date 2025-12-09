
import React, { useState, useMemo } from 'react';
import type { Student, UserProfile, BaseDataObject, TeachingAssignment, CreatedCredential } from '../types';
import AddStudentModal from './AddStudentModal'; 
import { PlusCircleIcon, DownloadIcon, TrashIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS, STUDENT_STATUSES } from '../constants';
import { exportToCsv } from '../utils/export';
import Pagination from './common/Pagination';

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
}

// Simple modal to show credentials after bulk generation
const CredentialsModal: React.FC<{ results: CreatedCredential[]; onClose: () => void }> = ({ results, onClose }) => {
    const handleExport = () => {
        exportToCsv(results, 'new_student_credentials.csv');
    };
    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Generated Credentials</h2>
                <div className="my-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                    <p className="font-bold">Important</p>
                    <p className="text-sm mt-1">Please export these credentials now. Passwords will not be shown again.</p>
                </div>
                <div className="flex-grow my-4 overflow-y-auto border-y border-slate-200/60 dark:border-slate-700/60">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-500/10 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Name</th>
                                <th className="px-4 py-2">Email</th>
                                <th className="px-4 py-2">Password</th>
                                <th className="px-4 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((res, index) => (
                                <tr key={index} className="border-b border-slate-200/60 dark:border-slate-700/60">
                                    <td className="px-4 py-2 font-medium">{res.name}</td>
                                    <td className="px-4 py-2">{res.email}</td>
                                    <td className="px-4 py-2 font-mono">{res.password || 'N/A'}</td>
                                    <td className="px-4 py-2">{res.status}</td>
                                </tr>
                            ))}
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
    onOpenCreateStudentAccountModal, allClasses, allArms, users, teachingAssignments, onBulkCreateStudentAccounts, onBulkResetStrikes, onBulkDeleteAccounts, onBulkRetrievePasswords, onDeleteStudent, onBulkDeleteStudents
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

  const canManageStudents = userPermissions.includes('manage-students') || userPermissions.includes('*');

  const teachers = useMemo(() => 
    users.filter(u => u.role === 'Teacher' || u.role === 'Team Lead').sort((a,b) => a.name.localeCompare(b.name))
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

  const commonInputClasses = "w-full p-2 text-sm border rounded-md bg-white/50 dark:bg-slate-800/50 border-slate-300/60 dark:border-slate-700/60 focus:ring-blue-500 focus:border-blue-500";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Student Roster</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Manage all students in the school.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ℹ️ Passwords are only shown once during account creation. Students use their email/username to login.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={handleGenerateAwards}
                disabled={isGeneratingAwards}
                className="text-sm bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 disabled:bg-amber-400 flex items-center justify-center min-w-[150px]"
            >
                {isGeneratingAwards ? <Spinner size="sm" /> : '✨ Generate Awards'}
            </button>
            {canManageStudents && <button onClick={onOpenCreateStudentAccountModal} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 text-sm">Create Account (Single)</button>}
            {canManageStudents && <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm">Add Student (No Login)</button>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
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
            <button onClick={handleExportStudents} className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1" title="Export Students">
                <DownloadIcon className="w-4 h-4" />
            </button>
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

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-500/10">
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
      
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddStudent={handleAddStudent}
        allClasses={allClasses}
        allArms={allArms}
      />

      {credentials && <CredentialsModal results={credentials} onClose={() => setCredentials(null)} />}
    </div>
  );
};

export default StudentListView;
