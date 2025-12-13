

import React, { useState } from 'react';
import type { LeaveType } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon } from './common/icons';

interface LeaveTypesManagerProps {
    leaveTypes: LeaveType[];
    onSave: (data: Partial<LeaveType>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
}

const LeaveTypesManager: React.FC<LeaveTypesManagerProps> = ({ leaveTypes, onSave, onDelete }) => {
    const [editing, setEditing] = useState<Partial<LeaveType> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: Partial<LeaveType>) => {
        setIsSaving(true);
        const success = await onSave(data);
        if (success) {
            setEditing(null);
        }
        setIsSaving(false);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Manage Leave Types</h3>
            {!editing && (
                <button onClick={() => setEditing({})} className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100">
                    <PlusCircleIcon className="w-5 h-5"/> Add New Leave Type
                </button>
            )}
            {editing && (
                <ItemForm 
                    item={editing} 
                    onSave={handleSave} 
                    onCancel={() => setEditing(null)} 
                    isSaving={isSaving} 
                />
            )}
            <div className="space-y-2">
                {leaveTypes.map(item => (
                    <div key={item.id} className="p-3 border rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-sm text-slate-500">Days Allowed: {item.days_allowed || 'Unlimited'}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(item)} className="text-sm font-semibold">Edit</button>
                            <button onClick={() => {
                                if (window.confirm('Are you sure you want to delete this leave type? This action cannot be undone and may affect leave requests using this type.')) {
                                    onDelete(item.id);
                                }
                            }} className="text-sm font-semibold text-red-600">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ItemForm: React.FC<{
    item: Partial<LeaveType>;
    onSave: (item: Partial<LeaveType>) => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ item, onSave, onCancel, isSaving }) => {
    const [localItem, setLocalItem] = useState(item);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        // FIX: Only access 'checked' property for checkbox inputs.
        const isCheckbox = type === 'checkbox';
        if (isCheckbox) {
            const checked = (e.target as HTMLInputElement).checked;
            setLocalItem(prev => ({ ...prev, [name]: checked }));
        } else {
            setLocalItem(prev => ({ ...prev, [name]: value }));
        }
    };

    return (
        <div className="p-4 border rounded-lg bg-slate-500/5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="name" value={localItem.name || ''} onChange={handleChange} placeholder="Leave Name (e.g., Sick Leave)" className="p-2 border rounded"/>
                <input name="days_allowed" type="number" value={localItem.days_allowed || ''} onChange={handleChange} placeholder="Days Allowed Per Year" className="p-2 border rounded"/>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" name="requires_approval" checked={localItem.requires_approval !== false} onChange={handleChange} /> Requires Approval</label>
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel}>Cancel</button>
                <button onClick={() => onSave(localItem)} disabled={isSaving}>{isSaving ? <Spinner size="sm"/> : 'Save'}</button>
            </div>
        </div>
    );
};

export default LeaveTypesManager;