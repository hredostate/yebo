import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import type { LeaveRequest, LeaveType, UserProfile } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon } from './common/icons';

interface LeaveRequestViewProps {
    currentUser: UserProfile;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    leaveRequests?: LeaveRequest[];
    leaveTypes?: LeaveType[];
    onSave?: (data: Partial<LeaveRequest>) => Promise<boolean>;
    onDelete?: (id: number) => Promise<boolean>;
}

const LeaveRequestView: React.FC<LeaveRequestViewProps> = ({ 
    currentUser, 
    addToast,
    leaveRequests: propsRequests,
    leaveTypes: propsTypes,
    onSave,
    onDelete
}) => {
    // Only fetch internally if props not provided (fallback for standalone use)
    const [internalRequests, setInternalRequests] = useState<LeaveRequest[]>([]);
    const [internalTypes, setInternalTypes] = useState<LeaveType[]>([]);
    const [isLoading, setIsLoading] = useState(!propsRequests);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const requests = propsRequests || internalRequests;
    const leaveTypes = propsTypes || internalTypes;

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const { data: types, error: typesError } = await supabase.from('leave_types').select('*');
        if (typesError) addToast('Failed to load leave types.', 'error');
        else setInternalTypes(types || []);

        const { data: requestsData, error: requestsError } = await supabase
            .from('leave_requests')
            .select('*, leave_type:leave_types(*)')
            .eq('requester_id', currentUser.id)
            .order('start_date', { ascending: false });

        if (requestsError) addToast('Failed to load leave history.', 'error');
        else setInternalRequests(requestsData || []);

        setIsLoading(false);
    }, [currentUser.id, addToast]);

    // Only fetch if props not provided
    useEffect(() => {
        if (!propsRequests || !propsTypes) {
            fetchData();
        }
    }, [propsRequests, propsTypes, fetchData]);

    const handleSave = async (data: Partial<Omit<LeaveRequest, 'id'>>) => {
        // Use provided onSave if available, otherwise use internal implementation
        if (onSave) {
            const success = await onSave(data as Partial<LeaveRequest>);
            if (success && !propsRequests) {
                // Only refetch if using internal state
                await fetchData();
            }
            return success;
        }
        
        // Fallback to internal implementation
        const { error } = await supabase.from('leave_requests').insert({
            ...data,
            requester_id: currentUser.id,
            school_id: currentUser.school_id,
        });
        if (error) {
            addToast(`Failed to submit request: ${error.message}`, 'error');
            return false;
        } else {
            addToast('Leave request submitted.', 'success');
            await fetchData();
            return true;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold">My Leave Requests</h1>
                <p className="text-slate-600 mt-1">Request time off and view your leave history.</p>
            </div>

            <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40">
                <button onClick={() => setIsFormOpen(!isFormOpen)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    <PlusCircleIcon className="w-5 h-5"/> {isFormOpen ? 'Cancel' : 'New Leave Request'}
                </button>

                {isFormOpen && <LeaveRequestForm leaveTypes={leaveTypes} onSave={handleSave} onClose={() => setIsFormOpen(false)} />}
            </div>

            <div className="space-y-3">
                <h2 className="text-xl font-bold">My History</h2>
                {isLoading && <Spinner />}
                {!isLoading && requests.length === 0 && <p className="text-slate-500">You have no leave requests.</p>}
                {!isLoading && requests.map(req => (
                    <div key={req.id} className="p-3 border rounded-lg flex justify-between items-center bg-slate-100 dark:bg-slate-800">
                        <div>
                            <p className="font-semibold">{req.leave_type?.name}</p>
                            <p className="text-sm text-slate-500">{new Date(req.start_date + 'T00:00:00').toLocaleDateString()} to {new Date(req.end_date + 'T00:00:00').toLocaleDateString()}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            req.status === 'approved' ? 'bg-green-200 text-green-800' :
                            req.status === 'rejected' ? 'bg-red-200 text-red-800' :
                            'bg-yellow-200 text-yellow-800'
                        }`}>{req.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

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
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select value={leaveTypeId} onChange={e => setLeaveTypeId(e.target.value)} required className="p-2 border rounded-md">
                    <option value="">Select Leave Type</option>
                    {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                </select>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="p-2 border rounded-md" />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="p-2 border rounded-md" />
            </div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for leave (optional)" rows={3} className="w-full p-2 border rounded-md" />
            <div className="flex justify-end">
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-green-600 text-white rounded-md">{isSaving ? <Spinner size="sm"/> : 'Submit Request'}</button>
            </div>
        </form>
    );
};

export default LeaveRequestView;