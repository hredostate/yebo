
import React, { useState } from 'react';
import type { LeaveRequest, LeaveType, UserProfile, LeaveRequestStatus } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, TrashIcon } from './common/icons';

interface MyLeaveViewProps {
    currentUser: UserProfile;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    leaveRequests: LeaveRequest[];
    leaveTypes: LeaveType[];
    onSave: (data: Partial<Omit<LeaveRequest, 'id'>>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
}

const LeaveRequestForm: React.FC<{
    leaveTypes: LeaveType[];
    onSave: (data: Partial<Omit<LeaveRequest, 'id'>>) => Promise<boolean>;
    onClose: () => void;
}> = ({ leaveTypes, onSave, onClose }) => {
    const [leaveTypeId, setLeaveTypeId] = useState<string>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const success = await onSave({
            leave_type_id: Number(leaveTypeId),
            start_date: startDate,
            end_date: endDate,
            reason,
        });
        if (success) onClose();
        setIsSaving(false);
    };

    return (
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t space-y-4 animate-fade-in">
            <h3 className="font-semibold text-lg">New Leave Request</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select value={leaveTypeId} onChange={e => setLeaveTypeId(e.target.value)} required className="p-2 border rounded-md bg-transparent">
                    <option value="">Select Leave Type</option>
                    {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name} ({lt.days_allowed ? `${lt.days_allowed} days` : 'Unlimited'})</option>)}
                </select>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="p-2 border rounded-md bg-transparent" />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="p-2 border rounded-md bg-transparent" />
            </div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for leave (optional)" rows={3} className="w-full p-2 border rounded-md bg-transparent" />
            <div className="flex justify-end">
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 flex items-center min-w-[150px] justify-center">
                    {isSaving ? <Spinner size="sm"/> : 'Submit Request'}
                </button>
            </div>
        </form>
    );
};


const MyLeaveView: React.FC<MyLeaveViewProps> = ({ currentUser, addToast, leaveRequests, leaveTypes, onSave, onDelete }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    const getStatusChip = (status: LeaveRequestStatus) => {
        switch (status) {
            case 'approved': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800">Approved</span>;
            case 'rejected': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-200 text-red-800">Rejected</span>;
            default: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-200 text-yellow-800">Pending</span>;
        }
    };
    
    const displayRequests = leaveRequests;

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Leave Requests</h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Request time off and view your leave history.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/60 bg-white/60 dark:bg-slate-900/40">
                <button onClick={() => setIsFormOpen(!isFormOpen)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    <PlusCircleIcon className="w-5 h-5"/> {isFormOpen ? 'Cancel' : 'New Leave Request'}
                </button>

                {isFormOpen && <LeaveRequestForm leaveTypes={leaveTypes} onSave={onSave} onClose={() => setIsFormOpen(false)} />}
            </div>

            <div className="space-y-3">
                <h2 className="text-xl font-bold">My History</h2>
                {displayRequests.length === 0 && <p className="text-slate-500">You have no leave requests.</p>}
                {displayRequests.filter(Boolean).map(req => (
                    <div key={req.id} className="p-3 border rounded-lg flex justify-between items-center bg-slate-100 dark:bg-slate-800">
                        <div>
                            <p className="font-semibold">{req.leave_type?.name || 'Unknown Type'}</p>
                            <p className="text-sm text-slate-500">{new Date(req.start_date + 'T00:00:00').toLocaleDateString()} to {new Date(req.end_date + 'T00:00:00').toLocaleDateString()}</p>
                            {req.reason && <p className="text-xs italic text-slate-600 mt-1">"{req.reason}"</p>}
                        </div>
                        <div className="flex items-center gap-4">
                            {getStatusChip(req.status)}
                            {req.status === 'pending' && (
                                <button onClick={() => onDelete(req.id)} className="text-red-500 hover:text-red-700">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MyLeaveView;
