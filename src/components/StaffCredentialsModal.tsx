import React from 'react';
import { DownloadIcon, CloseIcon } from './common/icons';
import { exportToCsv } from '../utils/export';

interface StaffCredential {
    name: string;
    username: string;
    password: string;
    status: 'Success' | 'Failed' | 'Skipped';
    error?: string;
    messagingResults?: Array<{
        phone: string;
        success: boolean;
        channel?: string;
        error?: string;
    }>;
}

interface StaffCredentialsModalProps {
    results: StaffCredential[];
    onClose: () => void;
}

const StaffCredentialsModal: React.FC<StaffCredentialsModalProps> = ({ results, onClose }) => {
    const handleExport = () => {
        const exportData = results.map((res) => {
            const msgResults = res.messagingResults || [];
            const phone = msgResults.find(m => m.phone)?.phone || '';
            const smsStatus = msgResults.length > 0 
                ? (msgResults[0].success ? 'Sent' : `Failed: ${msgResults[0].error || 'Unknown error'}`)
                : 'No phone';
            
            return {
                'Staff Name': res.name,
                'Username': res.username,
                'Password': res.password || 'N/A',
                'Phone Number': phone,
                'SMS Status': smsStatus,
                'Account Status': res.status,
                'Error': res.error || ''
            };
        });
        
        exportToCsv(exportData, 'staff_credentials.csv');
    };
    
    // Calculate messaging stats
    const messagingStats = results.reduce((acc, res) => {
        if (res.messagingResults && Array.isArray(res.messagingResults)) {
            res.messagingResults.forEach((msg) => {
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
    
    const successCount = results.filter(r => r.status === 'Success').length;
    const failedCount = results.filter(r => r.status === 'Failed').length;
    
    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-4xl m-4 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                        Staff Account Credentials
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Summary Stats */}
                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
                        <p className="text-sm text-green-700 dark:text-green-300">Accounts Created</p>
                        <p className="text-2xl font-bold text-green-800 dark:text-green-200">{successCount}</p>
                    </div>
                    {failedCount > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
                            <p className="text-sm text-red-700 dark:text-red-300">Failed</p>
                            <p className="text-2xl font-bold text-red-800 dark:text-red-200">{failedCount}</p>
                        </div>
                    )}
                    {(messagingStats.sent > 0 || messagingStats.failed > 0) && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
                            <p className="text-sm text-blue-700 dark:text-blue-300">SMS Sent</p>
                            <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                                {messagingStats.sent}
                                {messagingStats.failed > 0 && (
                                    <span className="text-sm text-red-600 dark:text-red-400 ml-2">
                                        ({messagingStats.failed} failed)
                                    </span>
                                )}
                            </p>
                        </div>
                    )}
                </div>

                <div className="my-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                    <p className="font-bold">⚠️ Important</p>
                    <p className="text-sm mt-1">Please export these credentials now. Passwords will not be shown again.</p>
                </div>
                
                {/* Messaging Summary */}
                {(messagingStats.sent > 0 || messagingStats.failed > 0) && (
                    <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 dark:bg-blue-900/20 dark:border-blue-400">
                        <p className="font-semibold text-blue-800 dark:text-blue-300">📱 SMS Summary</p>
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
                            {results.map((res, index) => {
                                const msgResults = res.messagingResults || [];
                                const sentCount = msgResults.filter(m => m.success).length;
                                const failCount = msgResults.length - sentCount;
                                
                                return (
                                    <tr key={index} className="border-b border-slate-200/60 dark:border-slate-700/60">
                                        <td className="px-4 py-2 font-medium">{res.name}</td>
                                        <td className="px-4 py-2 font-mono text-sm">{res.username}</td>
                                        <td className="px-4 py-2 font-mono text-sm">{res.password || 'N/A'}</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                res.status === 'Success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                res.status === 'Failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                                            }`}>
                                                {res.status}
                                            </span>
                                            {res.error && (
                                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{res.error}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            {msgResults.length === 0 ? (
                                                <span className="text-gray-500 text-xs">No phone</span>
                                            ) : (
                                                <span className="text-xs">
                                                    {sentCount > 0 && <span className="text-green-600 dark:text-green-400">✓ Sent</span>}
                                                    {failCount > 0 && <span className="text-red-600 dark:text-red-400">✗ Failed</span>}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                <div className="flex-shrink-0 flex justify-end gap-4 mt-4">
                    <button 
                        onClick={handleExport} 
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
            </div>
        </div>
    );
};

export default StaffCredentialsModal;
