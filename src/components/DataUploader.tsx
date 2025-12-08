
import React, { useState, useRef } from 'react';
import { DownloadIcon, UploadCloudIcon } from './common/icons';
import Spinner from './common/Spinner';
import type { CreatedCredential } from '../types';
import { exportToCsv } from '../utils/export';
import { validateStudentData, csvRowToIndex, type ValidationError } from '../utils/validation';

interface DataUploaderProps {
  onBulkAddStudents: (students: any[]) => Promise<{ success: boolean; message: string; credentials?: CreatedCredential[] }>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ValidationModal: React.FC<{
    errors: ValidationError[];
    validCount: number;
    invalidCount: number;
    totalCount: number;
    onProceed: () => void;
    onCancel: () => void;
}> = ({ errors, validCount, invalidCount, totalCount, onProceed, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-4xl m-4 flex flex-col max-h-[90vh]">
                <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Validation Errors Found</h2>
                
                <div className="my-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                    <p className="font-bold">Data Quality Issues Detected</p>
                    <p className="text-sm mt-1">
                        Found {errors.length} validation error{errors.length !== 1 ? 's' : ''} in {invalidCount} of {totalCount} rows.
                        {validCount > 0 && ` ${validCount} rows are valid and can be uploaded.`}
                    </p>
                </div>

                <div className="flex-grow my-4 overflow-y-auto border border-slate-200/60 dark:border-slate-700/60 rounded-lg">
                    <div className="p-4 space-y-3">
                        {errors.map((error, index) => (
                            <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                <div className="flex items-start gap-2">
                                    <span className="font-bold text-red-700 dark:text-red-400 min-w-[80px]">Row {error.row}:</span>
                                    <div className="flex-1">
                                        <p className="font-semibold text-slate-900 dark:text-white">{error.studentName}</p>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                                            <span className="font-medium">{error.field}:</span> {error.message}
                                        </p>
                                        {error.value && (
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
                                                Value: "{error.value}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-shrink-0 space-y-3">
                    {validCount > 0 ? (
                        <div className="p-3 bg-yellow-50 border border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                <strong>Note:</strong> You can proceed to upload the {validCount} valid row{validCount !== 1 ? 's' : ''}, or cancel and fix all issues in your CSV file.
                            </p>
                        </div>
                    ) : null}
                    <div className="flex justify-end gap-4">
                        <button 
                            onClick={onCancel} 
                            className="px-6 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30"
                        >
                            Cancel & Fix CSV
                        </button>
                        {validCount > 0 && (
                            <button 
                                onClick={onProceed} 
                                className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                            >
                                Proceed with {validCount} Valid Row{validCount !== 1 ? 's' : ''}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ResultsModal: React.FC<{
    results: CreatedCredential[];
    onClose: () => void;
}> = ({ results, onClose }) => {
    const handleExport = () => {
        exportToCsv(results, 'new_student_credentials.csv');
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-3xl m-4 flex flex-col max-h-[90vh]">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Upload Results</h2>
                
                <div className="my-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                    <p className="font-bold">Important: Download Credentials Now</p>
                    <p className="text-sm mt-1">For security, usernames and temporary passwords are shown only once. Please export the CSV and store it securely before closing this window. Students should use their username (not email) to login.</p>
                </div>

                <div className="flex-grow my-4 overflow-y-auto border-y border-slate-200/60 dark:border-slate-700/60">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-500/10 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Name</th>
                                <th className="px-4 py-2">Username</th>
                                <th className="px-4 py-2">Password</th>
                                <th className="px-4 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((res, index) => (
                                <tr key={index} className="border-b border-slate-200/60 dark:border-slate-700/60">
                                    <td className="px-4 py-2 font-medium">{res.name}</td>
                                    <td className="px-4 py-2 font-mono text-blue-600 dark:text-blue-400">{res.username || res.email || '-'}</td>
                                    <td className="px-4 py-2 font-mono">{res.password || 'N/A'}</td>
                                    <td className="px-4 py-2">
                                        {res.status === 'Failed' || res.status === 'Error' ? (
                                            <div className="flex flex-col">
                                                <span className="text-red-600 font-bold">Failed</span>
                                                {/* @ts-ignore - Error prop might exist on failed items */}
                                                <span className="text-xs text-red-500">{res.error || 'Unknown error'}</span>
                                            </div>
                                        ) : (
                                            <span className="text-green-600 font-semibold">{res.status}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex-shrink-0 flex justify-end gap-4">
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                        <DownloadIcon className="w-5 h-5" />
                        Export CSV
                    </button>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const DataUploader: React.FC<DataUploaderProps> = ({ onBulkAddStudents, addToast }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<CreatedCredential[] | null>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationError[] | null>(null);
    const [validationStats, setValidationStats] = useState<{ validCount: number; invalidCount: number; totalCount: number } | null>(null);
    const [pendingStudentsData, setPendingStudentsData] = useState<any[] | null>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);

        try {
            const text = await file.text();
            const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                throw new Error("CSV file must have a header row and at least one data row.");
            }
            
            const headers = lines[0].split(',').map(h => h.trim());
            const studentsData = lines.slice(1).map(line => {
                // Improved CSV splitting to handle quoted strings (e.g., "Doe, John")
                const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                return headers.reduce((obj, header, index) => {
                    let value = values[index]?.trim() || '';
                    // Remove surrounding quotes if present
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    (obj as any)[header] = value;
                    return obj;
                }, {});
            });

            // Validate the data before upload
            const validation = validateStudentData(studentsData);
            
            if (!validation.valid) {
                // Show validation errors and let user decide
                setValidationErrors(validation.errors);
                setValidationStats({
                    validCount: validation.validCount,
                    invalidCount: validation.invalidCount,
                    totalCount: studentsData.length
                });
                setPendingStudentsData(studentsData);
                setIsLoading(false);
                return;
            }

            // If validation passed, proceed with upload
            await performUpload(studentsData);
        } catch (error: any) {
            addToast(error.message, 'error');
            setIsLoading(false);
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const performUpload = async (studentsData: any[]) => {
        try {
            const { success, message, credentials } = await onBulkAddStudents(studentsData);
            addToast(message, success ? 'success' : 'error');
            if (credentials) {
                setResults(credentials);
            }
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleProceedWithValidRows = async () => {
        if (!pendingStudentsData || !validationErrors) return;
        
        setIsLoading(true);
        
        // Filter out rows with errors using helper function
        const errorRows = new Set(validationErrors.map(e => csvRowToIndex(e.row)));
        const validStudents = pendingStudentsData.filter((_, index) => !errorRows.has(index));
        
        // Clear validation state
        setValidationErrors(null);
        setValidationStats(null);
        setPendingStudentsData(null);
        
        // Proceed with upload
        await performUpload(validStudents);
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCancelValidation = () => {
        setValidationErrors(null);
        setValidationStats(null);
        setPendingStudentsData(null);
        setIsLoading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const downloadTemplate = () => {
        const headers = ['name', 'admission_number', 'class_name', 'arm_name', 'email', 'date_of_birth', 'parent_phone_number_1'];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(',');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "student_upload_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Bulk Data Uploader</h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">
                        Create student accounts by uploading a CSV file. 
                        Existing students (matched by Admission No. or Name) will have their accounts reset with new credentials.
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                    <h2 className="text-xl font-bold">Upload Student Data</h2>
                    <p className="text-sm text-slate-500 mt-2">
                        Recommended headers: <code>name</code>, <code>admission_number</code>, <code>class_name</code>, <code>arm_name</code>.
                        <br/>
                        The 'class_name' should match a class in the system (e.g., "JSS 1"). If <code>admission_number</code> matches an existing record, it will be overwritten.
                    </p>
                    <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-500 dark:bg-blue-900/20 dark:border-blue-700">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Data Quality Tip:</strong> Files are validated before upload. Email addresses and phone numbers will be checked for proper formatting.
                            Phone numbers exported from Excel should be formatted as "Text" to avoid scientific notation (e.g., 2.35E+12).
                        </p>
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-4">
                        <button onClick={downloadTemplate} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                            <DownloadIcon className="w-5 h-5" />
                            Download Template
                        </button>
                        <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 cursor-pointer">
                            <UploadCloudIcon className="w-5 h-5" />
                            <span>{isLoading ? 'Processing...' : 'Upload CSV File'}</span>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" disabled={isLoading} />
                        </label>
                        {isLoading && <Spinner />}
                    </div>
                </div>
            </div>
            {validationErrors && validationStats && (
                <ValidationModal
                    errors={validationErrors}
                    validCount={validationStats.validCount}
                    invalidCount={validationStats.invalidCount}
                    totalCount={validationStats.totalCount}
                    onProceed={handleProceedWithValidRows}
                    onCancel={handleCancelValidation}
                />
            )}
            {results && <ResultsModal results={results} onClose={() => setResults(null)} />}
        </>
    );
};

export default DataUploader;
