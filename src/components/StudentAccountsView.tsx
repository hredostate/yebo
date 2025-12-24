import type { SmsResult } from '../services/activationLinks';

import React, { useState, useMemo } from 'react';
import type { Student, BaseDataObject, CreatedCredential } from '../types';
import { DownloadIcon, KeyIcon, CheckCircleIcon, CloseIcon, SearchIcon } from './common/icons';
import Spinner from './common/Spinner';
import { exportToCsv } from '../utils/export';
import Pagination from './common/Pagination';
import { type ActivationLinkResult } from '../services/activationLinks';

interface StudentAccountsViewProps {
  students: Student[];
  allClasses: BaseDataObject[];
  allArms: BaseDataObject[];
  onBulkCreateStudentAccounts: (studentIds: number[]) => Promise<{ success: boolean; message: string; credentials?: CreatedCredential[] }>;
  onBulkRetrievePasswords: (studentIds: number[]) => Promise<{ success: boolean; credentials?: CreatedCredential[] }>;
  onGenerateActivationLinks: (
    studentIds: number[],
    options: { expiryHours: number; phoneField: 'parent_phone_number_1' | 'parent_phone_number_2' | 'student_phone'; template: string; sendSms?: boolean }
  ) => Promise<{ success: boolean; results: ActivationLinkResult[]; expires_at: string; sms_results?: SmsResult[] }>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onViewStudent: (student: Student) => void;
}

// Credentials Modal Component
const CredentialsModal: React.FC<{ results: CreatedCredential[]; onClose: () => void }> = ({ results, onClose }) => {
    const handleExport = () => {
        const exportData = results.map((res: any) => {
            const username = res.username || (res.email ? res.email.replace('@upsshub.com', '') : 'N/A');
            const msgResults = res.messagingResults || [];
            const phone1 = msgResults.find((m: any) => m.phone)?.phone || '';
            const phone2 = msgResults[1]?.phone || '';
            
            return {
                'Student Name': res.name,
                'Username': username,
                'Password': res.password || 'N/A',
                'Parent Phone 1': phone1,
                'Parent Phone 2': phone2,
                'SMS Message': `Hello! This is UPSS. Login credentials for ${res.name}: Username: ${username}, Password: ${res.password}. Visit the student portal to access.`,
                'Status': res.status,
            };
        });
        
        exportToCsv(exportData, 'student_credentials.csv');
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
                        <p className="font-semibold text-blue-800 dark:text-blue-300">SMS Summary</p>
                        <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                            {messagingStats.sent > 0 && `✓ ${messagingStats.sent} sent successfully`}
                            {messagingStats.sent > 0 && messagingStats.failed > 0 && ' | '}
                            {messagingStats.failed > 0 && `✗ ${messagingStats.failed} failed`}
                            {messagingStats.noPhone > 0 && ` | ℹ ${messagingStats.noPhone} no phone`}
                        </p>
                    </div>
                )}
                
                <div className="flex-grow my-4 overflow-y-auto border-y border-slate-200/60 dark:border-slate-700/60">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-500/10 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Name</th>
                                <th className="px-4 py-2">Username</th>
                                <th className="px-4 py-2">Password</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2">SMS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((res: any, index) => {
                                const msgResults = res.messagingResults || [];
                                const sentCount = msgResults.filter((m: any) => m.success).length;
                                const failCount = msgResults.length - sentCount;
                                const displayUsername = res.username || (res.email ? res.email.replace('@upsshub.com', '') : 'N/A');
                                
                                return (
                                    <tr key={index} className="border-b border-slate-200/60 dark:border-slate-700/60">
                                        <td className="px-4 py-2 font-medium">{res.name}</td>
                                        <td className="px-4 py-2 font-mono text-sm">{displayUsername}</td>
                                        <td className="px-4 py-2 font-mono text-sm">{res.password || 'N/A'}</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                res.status === 'Success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                res.status === 'Failed' || res.status === 'Error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                                            }`}>
                                                {res.status}
                                            </span>
                                        </td>
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
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors">
                        <DownloadIcon className="w-5 h-5" /> Export CSV
                    </button>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30 transition-colors">Close</button>
                </div>
            </div>
        </div>
    );
};

// Activation Links Modal Component
const ActivationLinksModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: () => void;
    expiryHours: number;
    setExpiryHours: (hours: number) => void;
    phoneField: 'parent_phone_number_1' | 'parent_phone_number_2' | 'student_phone';
    setPhoneField: (field: 'parent_phone_number_1' | 'parent_phone_number_2' | 'student_phone') => void;
    template: string;
    setTemplate: (template: string) => void;
    sendSms: boolean;
    setSendSms: (send: boolean) => void;
    isGenerating: boolean;
    results: ActivationLinkResult[] | null;
    expiresAt: string | null;
    smsResults: SmsResult[] | null;
}> = ({
    isOpen,
    onClose,
    onGenerate,
    expiryHours,
    setExpiryHours,
    phoneField,
    setPhoneField,
    template,
    setTemplate,
    sendSms,
    setSendSms,
    isGenerating,
    results,
    expiresAt,
    smsResults,
}) => {
    if (!isOpen) return null;

    const handleExportActivationLinks = () => {
        if (!results) return;
        
        const exportData = results.map(row => {
            const classArm = [row.class_name, row.arm_name].filter(Boolean).join(' ');
            const phone = phoneField === 'parent_phone_number_1' ? row.phone_1 :
                         phoneField === 'parent_phone_number_2' ? row.phone_2 :
                         row.student_phone;
            
            const message = template
                .replace('{parent_or_student_name}', row.student_name || 'Parent/Guardian')
                .replace('{student_name}', row.student_name || 'Student')
                .replace('{class_arm}', classArm || 'their class')
                .replace('{activation_link}', row.activation_link || '')
                .replace('{username}', row.username || row.admission_number || '')
                .replace('{expires_at}', expiresAt ? new Date(expiresAt).toLocaleString() : '')
                .replace('{school_name}', 'UPSS')
                .replace('{recipient_phone}', phone || '');
            
            return {
                'Student Name': row.student_name || '',
                'Admission Number': row.admission_number || '',
                'Class': classArm,
                'Username': row.username || row.admission_number || '',
                'Phone': phone || '',
                'Activation Link': row.activation_link || '',
                'Expires At': expiresAt ? new Date(expiresAt).toLocaleString() : '',
                'Status': row.status,
                'SMS Message': message,
            };
        });
        
        exportToCsv(exportData, 'activation_links.csv');
    };

    const smsStats = smsResults ? smsResults.reduce((acc, r) => {
        if (r.success) acc.sent++;
        else acc.failed++;
        return acc;
    }, { sent: 0, failed: 0 }) : null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-4xl m-4 flex flex-col max-h-[90vh]">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Generate Activation Links</h2>
                
                {!results ? (
                    <>
                        {/* Configuration Form */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Link Expiry Time
                                </label>
                                <select
                                    value={expiryHours}
                                    onChange={(e) => setExpiryHours(Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                >
                                    <option value={24}>24 hours</option>
                                    <option value={48}>48 hours</option>
                                    <option value={72}>72 hours (3 days)</option>
                                    <option value={168}>7 days</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Send SMS To
                                </label>
                                <select
                                    value={phoneField}
                                    onChange={(e) => setPhoneField(e.target.value as any)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                >
                                    <option value="parent_phone_number_1">Parent Phone 1</option>
                                    <option value="parent_phone_number_2">Parent Phone 2</option>
                                    <option value="student_phone">Student Phone</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    SMS Message Template
                                </label>
                                <textarea
                                    value={template}
                                    onChange={(e) => setTemplate(e.target.value)}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm"
                                    placeholder="Use placeholders: {parent_or_student_name}, {student_name}, {class_arm}, {activation_link}, {username}, {expires_at}, {school_name}"
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Available: {'{parent_or_student_name}'}, {'{student_name}'}, {'{class_arm}'}, {'{activation_link}'}, {'{username}'}, {'{expires_at}'}, {'{school_name}'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="sendSmsToggle"
                                    checked={sendSms}
                                    onChange={(e) => setSendSms(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <label htmlFor="sendSmsToggle" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Auto-send SMS after generation
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 mt-6">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onGenerate}
                                disabled={isGenerating}
                                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <Spinner size="sm" />
                                        Generating...
                                    </>
                                ) : (
                                    'Generate Links'
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Results Display */}
                        {smsStats && (
                            <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 dark:bg-blue-900/20 dark:border-blue-400">
                                <p className="font-semibold text-blue-800 dark:text-blue-300">SMS Summary</p>
                                <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                                    {smsStats.sent > 0 && `✓ ${smsStats.sent} sent successfully`}
                                    {smsStats.sent > 0 && smsStats.failed > 0 && ' | '}
                                    {smsStats.failed > 0 && `✗ ${smsStats.failed} failed`}
                                </p>
                            </div>
                        )}

                        <div className="flex-grow my-4 overflow-y-auto border-y border-slate-200/60 dark:border-slate-700/60">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-slate-500/10 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2">Student</th>
                                        <th className="px-4 py-2">Class</th>
                                        <th className="px-4 py-2">Username</th>
                                        <th className="px-4 py-2">Status</th>
                                        <th className="px-4 py-2">Link</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((row, index) => {
                                        const classArm = [row.class_name, row.arm_name].filter(Boolean).join(' ');
                                        return (
                                            <tr key={index} className="border-b border-slate-200/60 dark:border-slate-700/60">
                                                <td className="px-4 py-2 font-medium">{row.student_name}</td>
                                                <td className="px-4 py-2">{classArm}</td>
                                                <td className="px-4 py-2 font-mono text-xs">{row.username || row.admission_number}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-1 rounded text-xs ${
                                                        row.status === 'created' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                        row.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                                        'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                                                    }`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {row.activation_link && (
                                                        <a
                                                            href={row.activation_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline"
                                                        >
                                                            View
                                                        </a>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-4">
                            <button
                                onClick={handleExportActivationLinks}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                            >
                                <DownloadIcon className="w-5 h-5" /> Export CSV
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const StudentAccountsView: React.FC<StudentAccountsViewProps> = ({
    students,
    allClasses,
    allArms,
    onBulkCreateStudentAccounts,
    onBulkRetrievePasswords,
    onGenerateActivationLinks,
    addToast,
    onViewStudent,
}) => {
    // State Management
    const [searchTerm, setSearchTerm] = useState('');
    const [accountFilter, setAccountFilter] = useState<'all' | 'with' | 'without'>('all');
    const [classFilter, setClassFilter] = useState('');
    const [armFilter, setArmFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(25);
    
    // Credentials Modal
    const [credentials, setCredentials] = useState<CreatedCredential[] | null>(null);
    const [isGeneratingAccounts, setIsGeneratingAccounts] = useState(false);
    const [isRetrievingPasswords, setIsRetrievingPasswords] = useState(false);
    
    // Activation Links Modal
    const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
    const [activationExpiryHours, setActivationExpiryHours] = useState(72);
    const [activationPhoneField, setActivationPhoneField] = useState<'parent_phone_number_1' | 'parent_phone_number_2' | 'student_phone'>('parent_phone_number_1');
    const [activationTemplate, setActivationTemplate] = useState(
        'Hello {parent_or_student_name}. This is {school_name}. {student_name} ({class_arm}) can activate their portal account using this link: {activation_link}. Username: {username}. Link expires {expires_at}. Thank you.'
    );
    const [sendSmsEnabled, setSendSmsEnabled] = useState(true);
    const [isGeneratingActivationLinks, setIsGeneratingActivationLinks] = useState(false);
    const [activationResults, setActivationResults] = useState<ActivationLinkResult[] | null>(null);
    const [activationExpiresAt, setActivationExpiresAt] = useState<string | null>(null);
    const [smsResults, setSmsResults] = useState<SmsResult[] | null>(null);

    // Calculate statistics
    const stats = useMemo(() => {
        const total = students.length;
        const withAccounts = students.filter(s => s.user_id).length;
        const withoutAccounts = total - withAccounts;
        
        return { total, withAccounts, withoutAccounts };
    }, [students]);

    // Filter students
    const filteredStudents = useMemo(() => {
        return students.filter(student => {
            // Search filter
            const searchLower = searchTerm.toLowerCase();
            const nameMatch = student.name.toLowerCase().includes(searchLower);
            const admissionMatch = student.admission_number?.toLowerCase().includes(searchLower) || false;
            const username = student.email ? student.email.replace('@upsshub.com', '') : '';
            const usernameMatch = username.toLowerCase().includes(searchLower);
            
            if (searchTerm && !(nameMatch || admissionMatch || usernameMatch)) {
                return false;
            }
            
            // Account filter
            if (accountFilter === 'with' && !student.user_id) return false;
            if (accountFilter === 'without' && student.user_id) return false;
            
            // Class filter
            if (classFilter && student.class_id !== Number(classFilter)) return false;
            
            // Arm filter
            if (armFilter && student.arm_id !== Number(armFilter)) return false;
            
            return true;
        });
    }, [students, searchTerm, accountFilter, classFilter, armFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredStudents.slice(start, start + itemsPerPage);
    }, [filteredStudents, currentPage, itemsPerPage]);

    // Reset page when filters change
    useMemo(() => {
        setCurrentPage(1);
    }, [searchTerm, accountFilter, classFilter, armFilter]);

    // Selection Handlers
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const isAllVisibleSelected = paginatedStudents.length > 0 && paginatedStudents.every(s => selectedIds.has(s.id));

    // Bulk Actions
    const handleBulkCreateAccounts = async () => {
        if (selectedIds.size === 0) {
            addToast('Please select at least one student', 'error');
            return;
        }
        
        // Filter to only students without accounts
        const studentsWithoutAccounts = students.filter(s => selectedIds.has(s.id) && !s.user_id);
        
        if (studentsWithoutAccounts.length === 0) {
            addToast('All selected students already have accounts', 'info');
            return;
        }
        
        if (!window.confirm(`Generate login credentials for ${studentsWithoutAccounts.length} students?`)) {
            return;
        }
        
        setIsGeneratingAccounts(true);
        try {
            const { success, credentials: creds, message } = await onBulkCreateStudentAccounts(studentsWithoutAccounts.map(s => s.id));
            if (success && creds) {
                setCredentials(creds);
                setSelectedIds(new Set());
                addToast(message || 'Accounts created successfully', 'success');
            } else {
                addToast(message || 'Failed to create accounts', 'error');
            }
        } catch (error: any) {
            addToast(error.message || 'Failed to create accounts', 'error');
        } finally {
            setIsGeneratingAccounts(false);
        }
    };

    const handleBulkRetrievePasswords = async () => {
        if (selectedIds.size === 0) {
            addToast('Please select at least one student', 'error');
            return;
        }
        
        // Filter to only students with accounts
        const studentsWithAccounts = students.filter(s => selectedIds.has(s.id) && s.user_id);
        
        if (studentsWithAccounts.length === 0) {
            addToast('None of the selected students have login accounts', 'info');
            return;
        }
        
        if (!window.confirm(`Retrieve passwords for ${studentsWithAccounts.length} students?`)) {
            return;
        }
        
        setIsRetrievingPasswords(true);
        try {
            const { success, credentials: creds } = await onBulkRetrievePasswords(studentsWithAccounts.map(s => s.id));
            if (success && creds) {
                setCredentials(creds);
                setSelectedIds(new Set());
                addToast('Passwords retrieved successfully', 'success');
            } else {
                addToast('Failed to retrieve passwords', 'error');
            }
        } catch (error: any) {
            addToast(error.message || 'Failed to retrieve passwords', 'error');
        } finally {
            setIsRetrievingPasswords(false);
        }
    };

    const handleOpenActivationModal = () => {
        if (selectedIds.size === 0) {
            addToast('Please select at least one student', 'error');
            return;
        }
        
        setActivationResults(null);
        setActivationExpiresAt(null);
        setSmsResults(null);
        setIsActivationModalOpen(true);
    };

    const handleGenerateActivationLinks = async () => {
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
                
                if (sendSmsEnabled && response.sms_results) {
                    const successCount = response.sms_results.filter(r => r.success).length;
                    const failCount = response.sms_results.filter(r => !r.success).length;
                    if (successCount > 0) {
                        addToast(`${successCount} SMS sent successfully${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
                    } else if (failCount > 0) {
                        addToast(`Failed to send ${failCount} SMS`, 'error');
                    }
                }
            } else {
                addToast('Failed to generate activation links', 'error');
            }
        } catch (error: any) {
            addToast(error.message || 'Failed to generate activation links', 'error');
        } finally {
            setIsGeneratingActivationLinks(false);
        }
    };

    const handleExportCredentials = () => {
        const selectedStudents = students.filter(s => selectedIds.has(s.id));
        
        const exportData = selectedStudents.map(student => {
            const username = student.email ? student.email.replace('@upsshub.com', '') : 'No Account';
            const classArm = [student.class?.name, student.arm?.name].filter(Boolean).join(' ');
            
            return {
                'Student Name': student.name,
                'Admission Number': student.admission_number || '',
                'Class/Arm': classArm,
                'Username': username,
                'Password': '(Use Retrieve Passwords function)',
                'Parent Phone 1': student.parent_phone_number_1 || '',
                'Parent Phone 2': student.parent_phone_number_2 || '',
                'SMS Message': `Hello! Login credentials for ${student.name}: Username: ${username}. Visit the student portal.`,
                'Account Status': student.user_id ? 'Active' : 'Missing',
            };
        });
        
        exportToCsv(exportData, 'student_accounts_export.csv');
        addToast('Exported to CSV', 'success');
    };

    const getUsername = (student: Student) => {
        if (!student.user_id || !student.email) return null;
        return student.email.replace('@upsshub.com', '');
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <KeyIcon className="w-8 h-8 text-blue-600" />
                        Student Accounts
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Manage student login accounts and credentials
                    </p>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-lg dark:border-slate-800/60 dark:bg-slate-900/80">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Students</div>
                    <div className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{stats.total}</div>
                </div>
                
                <div className="rounded-xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-lg dark:border-slate-800/60 dark:bg-slate-900/80">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400">With Accounts</div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.withAccounts}</div>
                </div>
                
                <div className="rounded-xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-lg dark:border-slate-800/60 dark:bg-slate-900/80">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Without Accounts</div>
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">{stats.withoutAccounts}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-lg dark:border-slate-800/60 dark:bg-slate-900/80">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search name, admission #, username..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                    </div>
                    
                    <select
                        value={accountFilter}
                        onChange={(e) => setAccountFilter(e.target.value as any)}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                        <option value="all">All Students</option>
                        <option value="with">With Account</option>
                        <option value="without">Without Account</option>
                    </select>
                    
                    <select
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                        <option value="">All Classes</option>
                        {allClasses.map(cls => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                    </select>
                    
                    <select
                        value={armFilter}
                        onChange={(e) => setArmFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                        <option value="">All Arms</option>
                        {allArms.map(arm => (
                            <option key={arm.id} value={arm.id}>{arm.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedIds.size > 0 && (
                <div className="rounded-xl border border-blue-200/60 bg-blue-50/80 p-4 backdrop-blur-xl shadow-lg dark:border-blue-800/60 dark:bg-blue-900/20">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className="font-semibold text-blue-800 dark:text-blue-300">
                            {selectedIds.size} selected
                        </span>
                        
                        <button
                            onClick={handleBulkCreateAccounts}
                            disabled={isGeneratingAccounts}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isGeneratingAccounts ? <Spinner size="sm" /> : <KeyIcon className="w-4 h-4" />}
                            Generate Accounts
                        </button>
                        
                        <button
                            onClick={handleOpenActivationModal}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <KeyIcon className="w-4 h-4" />
                            Generate Activation Links
                        </button>
                        
                        <button
                            onClick={handleBulkRetrievePasswords}
                            disabled={isRetrievingPasswords}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isRetrievingPasswords ? <Spinner size="sm" /> : <KeyIcon className="w-4 h-4" />}
                            Retrieve Passwords
                        </button>
                        
                        <button
                            onClick={handleExportCredentials}
                            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            Export CSV
                        </button>
                        
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white rounded-lg hover:bg-slate-500/30 transition-colors"
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="rounded-xl border border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-lg dark:border-slate-800/60 dark:bg-slate-900/80 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-500/10 border-b border-slate-200/60 dark:border-slate-700/60">
                            <tr>
                                <th className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={isAllVisibleSelected}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                </th>
                                <th className="px-4 py-3">Student Name</th>
                                <th className="px-4 py-3">Admission #</th>
                                <th className="px-4 py-3">Class / Arm</th>
                                <th className="px-4 py-3">Username</th>
                                <th className="px-4 py-3">Account Status</th>
                                <th className="px-4 py-3">Parent Phone 1</th>
                                <th className="px-4 py-3">Parent Phone 2</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                        No students found matching your filters
                                    </td>
                                </tr>
                            ) : (
                                paginatedStudents.map(student => {
                                    const username = getUsername(student);
                                    const classArm = [student.class?.name, student.arm?.name].filter(Boolean).join(' ');
                                    
                                    return (
                                        <tr key={student.id} className="border-b border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(student.id)}
                                                    onChange={() => handleSelectOne(student.id)}
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{student.name}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{student.admission_number || '-'}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{classArm || '-'}</td>
                                            <td className="px-4 py-3">
                                                {username ? (
                                                    <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{username}</span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 rounded text-xs">
                                                        No Account
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {student.user_id ? (
                                                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                                        <CheckCircleIcon className="w-4 h-4" />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                                        <CloseIcon className="w-4 h-4" />
                                                        Missing
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                                {student.parent_phone_number_1 || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                                {student.parent_phone_number_2 || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => onViewStudent(student)}
                                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm underline"
                                                >
                                                    View Profile
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-200/60 dark:border-slate-700/60">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </div>

            {/* Modals */}
            {credentials && (
                <CredentialsModal
                    results={credentials}
                    onClose={() => setCredentials(null)}
                />
            )}

            <ActivationLinksModal
                isOpen={isActivationModalOpen}
                onClose={() => {
                    setIsActivationModalOpen(false);
                    setActivationResults(null);
                    setActivationExpiresAt(null);
                    setSmsResults(null);
                }}
                onGenerate={handleGenerateActivationLinks}
                expiryHours={activationExpiryHours}
                setExpiryHours={setActivationExpiryHours}
                phoneField={activationPhoneField}
                setPhoneField={setActivationPhoneField}
                template={activationTemplate}
                setTemplate={setActivationTemplate}
                sendSms={sendSmsEnabled}
                setSendSms={setSendSmsEnabled}
                isGenerating={isGeneratingActivationLinks}
                results={activationResults}
                expiresAt={activationExpiresAt}
                smsResults={smsResults}
            />
        </div>
    );
};

export default StudentAccountsView;
