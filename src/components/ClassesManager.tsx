
import React, { useState } from 'react';
import type { BaseDataObject, Campus } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, BuildingIcon } from './common/icons';

interface ClassesManagerProps {
    classes: BaseDataObject[];
    campuses?: Campus[];
    onSave: (cls: Partial<BaseDataObject>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
}

const ClassesManager: React.FC<ClassesManagerProps> = ({ classes = [], campuses = [], onSave, onDelete }) => {
    const [editing, setEditing] = useState<Partial<BaseDataObject> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: Partial<BaseDataObject>) => {
        setIsSaving(true);
        const success = await onSave(data);
        if (success) {
            setEditing(null);
        }
        setIsSaving(false);
    };

    const getCampusName = (campusId?: number | null) => {
        if (!campusId) return null;
        return campuses.find(c => c.id === campusId)?.name || 'Unknown';
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Manage Classes</h3>
                <p className="text-xs text-slate-500">Assign classes to campuses for organization</p>
            </div>
            {!editing && (
                <button onClick={() => setEditing({})} className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100">
                    <PlusCircleIcon className="w-5 h-5"/> Add New Class
                </button>
            )}
            {editing && (
                <ItemForm 
                    item={editing} 
                    campuses={campuses}
                    onSave={handleSave} 
                    onCancel={() => setEditing(null)} 
                    isSaving={isSaving} 
                    placeholder="Class Name (e.g., JSS 1)"
                />
            )}
            <div className="space-y-2">
                {classes.map(cls => (
                    <div key={cls.id} className="p-3 border rounded-lg flex justify-between items-center bg-white dark:bg-slate-900">
                        <div>
                            <p className="font-semibold">{cls.name}</p>
                            {cls.campus_id && (
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                    <BuildingIcon className="w-3 h-3" />
                                    {getCampusName(cls.campus_id)}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(cls)} className="text-sm font-semibold text-blue-600 hover:underline">Edit</button>
                            <button onClick={() => {
                                if (window.confirm('Are you sure you want to delete this class? This action cannot be undone and may affect students, class assignments, and timetables.')) {
                                    onDelete(cls.id);
                                }
                            }} className="text-sm font-semibold text-red-600 hover:underline">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ItemForm: React.FC<{
    item: Partial<BaseDataObject>;
    campuses: Campus[];
    onSave: (item: Partial<BaseDataObject>) => void;
    onCancel: () => void;
    isSaving: boolean;
    placeholder: string;
}> = ({ item, campuses, onSave, onCancel, isSaving, placeholder }) => {
    const [localItem, setLocalItem] = useState(item);

    return (
        <div className="p-4 border rounded-lg bg-slate-500/5 space-y-3">
            <input 
                name="name" 
                value={localItem.name || ''} 
                onChange={e => setLocalItem(prev => ({ ...prev, name: e.target.value }))} 
                placeholder={placeholder} 
                className="p-2 border rounded w-full" 
            />
            {campuses.length > 0 && (
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Assign to Campus</label>
                    <select
                        value={localItem.campus_id || ''}
                        onChange={e => setLocalItem(prev => ({ ...prev, campus_id: e.target.value ? Number(e.target.value) : null }))}
                        className="p-2 border rounded w-full text-sm"
                    >
                        <option value="">No Campus (Main)</option>
                        {campuses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            )}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm bg-slate-200 dark:bg-slate-700 rounded-md">Cancel</button>
                <button onClick={() => onSave(localItem)} disabled={isSaving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md flex items-center gap-2">
                    {isSaving && <Spinner size="sm"/>} Save
                </button>
            </div>
        </div>
    );
};

export default ClassesManager;
