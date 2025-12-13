
import React, { useState } from 'react';
import type { BaseDataObject } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon } from './common/icons';

interface ArmsManagerProps {
    arms: BaseDataObject[];
    onSave: (arm: Partial<BaseDataObject>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
}

const ArmsManager: React.FC<ArmsManagerProps> = ({ arms = [], onSave, onDelete }) => {
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

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Manage Class Arms</h3>
            {!editing && (
                <button onClick={() => setEditing({})} className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100">
                    <PlusCircleIcon className="w-5 h-5"/> Add New Arm
                </button>
            )}
            {editing && (
                <ItemForm 
                    item={editing} 
                    onSave={handleSave} 
                    onCancel={() => setEditing(null)} 
                    isSaving={isSaving} 
                    placeholder="Arm Name (e.g., Gold)"
                />
            )}
            <div className="space-y-2">
                {arms.map(arm => (
                    <div key={arm.id} className="p-3 border rounded-lg flex justify-between items-center">
                        <p className="font-semibold">{arm.name}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(arm)} className="text-sm font-semibold">Edit</button>
                            <button onClick={() => {
                                if (window.confirm('Are you sure you want to delete this arm? This action cannot be undone and may affect students and class assignments.')) {
                                    onDelete(arm.id);
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
    item: Partial<BaseDataObject>;
    onSave: (item: Partial<BaseDataObject>) => void;
    onCancel: () => void;
    isSaving: boolean;
    placeholder: string;
}> = ({ item, onSave, onCancel, isSaving, placeholder }) => {
    const [localItem, setLocalItem] = useState(item);

    return (
        <div className="p-4 border rounded-lg bg-slate-500/5 flex items-center gap-4">
            <input 
                name="name" 
                value={localItem.name || ''} 
                onChange={e => setLocalItem(prev => ({ ...prev, name: e.target.value }))} 
                placeholder={placeholder} 
                className="p-2 border rounded flex-grow" 
            />
            <div className="flex gap-2">
                <button type="button" onClick={onCancel}>Cancel</button>
                <button onClick={() => onSave(localItem)} disabled={isSaving}>{isSaving ? <Spinner size="sm"/> : 'Save'}</button>
            </div>
        </div>
    );
};

export default ArmsManager;
