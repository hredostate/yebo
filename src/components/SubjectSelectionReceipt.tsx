import React, { useRef } from 'react';
import { StudentProfile } from '../types';
import { PrinterIcon, DownloadIcon, EnvelopeIcon, ClipboardIcon, CheckCircleIcon } from './common/icons';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface SubjectSelectionReceiptProps {
    studentProfile: StudentProfile;
    compulsorySubjects: Array<{ subject_id: number; subject_name: string }>;
    electiveSubjects: Array<{ subject_id: number; subject_name: string }>;
    lockedAt: string | null;
    termName?: string;
    sessionLabel?: string;
    onRequestChange: () => void;
}

const SubjectSelectionReceipt: React.FC<SubjectSelectionReceiptProps> = ({
    studentProfile,
    compulsorySubjects,
    electiveSubjects,
    lockedAt,
    termName = 'First Term',
    sessionLabel = '2024/2025',
    onRequestChange
}) => {
    const receiptRef = useRef<HTMLDivElement>(null);

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        if (!receiptRef.current) return;

        try {
            // Capture the receipt as an image
            const canvas = await html2canvas(receiptRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210; // A4 width in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Subject_Selection_Receipt_${studentProfile.full_name.replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try using the Print function instead.');
        }
    };

    const handleEmailCopy = () => {
        if (studentProfile.email) {
            const subject = encodeURIComponent('Subject Selection Confirmation');
            const body = encodeURIComponent(
                `Dear ${studentProfile.full_name},\n\n` +
                `This is to confirm your subject selection for ${sessionLabel} - ${termName}.\n\n` +
                `Please find your receipt attached or visit the student portal to view and print your confirmation.\n\n` +
                `Best regards,\nSchool Administration`
            );
            window.location.href = `mailto:${studentProfile.email}?subject=${subject}&body=${body}`;
        } else {
            alert('No email address available for this student.');
        }
    };

    const totalSubjects = compulsorySubjects.length + electiveSubjects.length;

    return (
        <>
            <style>
                {`
                    @media print {
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                            color-adjust: exact;
                        }
                        
                        .no-print {
                            display: none !important;
                        }
                        
                        .receipt-container {
                            box-shadow: none !important;
                            border: 1px solid #e5e7eb !important;
                            page-break-inside: avoid;
                        }
                        
                        .print-header {
                            display: block !important;
                        }
                    }
                    
                    @media screen {
                        .print-header {
                            display: none;
                        }
                    }
                `}
            </style>

            <div className="animate-fade-in">
                {/* Action Buttons - Screen Only */}
                <div className="no-print flex flex-wrap gap-3 mb-6">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <PrinterIcon className="w-5 h-5" />
                        Print Receipt
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        Download PDF
                    </button>
                    {studentProfile.email && (
                        <button
                            onClick={handleEmailCopy}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                        >
                            <EnvelopeIcon className="w-5 h-5" />
                            Email Copy
                        </button>
                    )}
                    <button
                        onClick={onRequestChange}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <ClipboardIcon className="w-5 h-5" />
                        Request Change
                    </button>
                </div>

                {/* Receipt Content */}
                <div
                    ref={receiptRef}
                    className="receipt-container bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                    {/* Print-only header */}
                    <div className="print-header p-6 text-center border-b border-slate-200">
                        <h1 className="text-2xl font-bold text-slate-900">School Management System</h1>
                        <p className="text-sm text-slate-600 mt-1">Subject Selection Confirmation Receipt</p>
                    </div>

                    {/* Receipt Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 p-6 text-white">
                        <div className="flex items-center gap-3 mb-3">
                            <ClipboardIcon className="w-8 h-8" />
                            <h2 className="text-2xl font-bold">Subject Selection Confirmation</h2>
                        </div>
                        <div className="h-1 w-full bg-white/20 rounded"></div>
                    </div>

                    {/* Student Information */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Student Name</p>
                                <p className="text-lg font-semibold text-slate-900 dark:text-white">{studentProfile.full_name}</p>
                            </div>
                            {studentProfile.id && (
                                <div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">Student ID</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{studentProfile.id.substring(0, 8).toUpperCase()}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Class</p>
                                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {studentProfile.class_name} {studentProfile.arm_name && `- ${studentProfile.arm_name}`}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Academic Session</p>
                                <p className="text-lg font-semibold text-slate-900 dark:text-white">{sessionLabel}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Term</p>
                                <p className="text-lg font-semibold text-slate-900 dark:text-white">{termName}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Date Confirmed</p>
                                <p className="text-lg font-semibold text-slate-900 dark:text-white">{formatDate(lockedAt)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Subject Summary Cards */}
                    <div className="p-6 space-y-6">
                        {/* Compulsory Subjects */}
                        {compulsorySubjects.length > 0 && (
                            <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                                <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-3 border-b border-blue-200 dark:border-blue-800">
                                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                                        📚 COMPULSORY SUBJECTS ({compulsorySubjects.length})
                                    </h3>
                                </div>
                                <div className="p-4 bg-white dark:bg-slate-800">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {compulsorySubjects.map((subject) => (
                                            <div
                                                key={subject.subject_id}
                                                className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                                            >
                                                <CheckCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                <span className="text-slate-800 dark:text-slate-200 font-medium">{subject.subject_name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Elective Subjects */}
                        {electiveSubjects.length > 0 && (
                            <div className="border border-green-200 dark:border-green-800 rounded-lg overflow-hidden">
                                <div className="bg-green-50 dark:bg-green-900/30 px-4 py-3 border-b border-green-200 dark:border-green-800">
                                    <h3 className="text-lg font-bold text-green-900 dark:text-green-100 flex items-center gap-2">
                                        📖 ELECTIVE SUBJECTS ({electiveSubjects.length})
                                    </h3>
                                </div>
                                <div className="p-4 bg-white dark:bg-slate-800">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {electiveSubjects.map((subject) => (
                                            <div
                                                key={subject.subject_id}
                                                className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                                            >
                                                <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                                <span className="text-slate-800 dark:text-slate-200 font-medium">{subject.subject_name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Summary Statistics */}
                        <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 p-6 rounded-lg border border-slate-200 dark:border-slate-600">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">📊 Summary Statistics</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalSubjects}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Total Subjects</p>
                                </div>
                                <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{compulsorySubjects.length}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Compulsory</p>
                                </div>
                                <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{electiveSubjects.length}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Elective</p>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-center gap-2 text-green-700 dark:text-green-300 font-semibold">
                                <CheckCircleIcon className="w-6 h-6" />
                                <span>Status: ✅ Confirmed & Locked</span>
                            </div>
                        </div>

                        {/* Additional Information */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3">ℹ️ Important Information</h3>
                            <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                                <p>• <strong>Next Steps:</strong> Your timetable will be available soon. Check back regularly for updates.</p>
                                <p>• <strong>Changes:</strong> To modify your subject selection, please contact your class teacher or school administrator using the "Request Change" button.</p>
                                <p>• <strong>Confirmation:</strong> Keep this receipt for your records. You can print or download it anytime from the student portal.</p>
                                {studentProfile.email && (
                                    <p>• <strong>Email:</strong> Use the "Email Copy" button above to send this receipt to {studentProfile.email}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-100 dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-600 dark:text-slate-400">
                        <p>This is an official record of your subject selection. Please retain for your records.</p>
                        <p className="mt-1">Printed on: {new Date().toLocaleString()}</p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SubjectSelectionReceipt;
