
import React, { useState } from 'react';
import type { Subject } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon } from './common/icons';

interface SubjectsManagerProps {
    subjects: Subject[];
    onSave: (subject: Partial<Subject>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
}

const SubjectsManager: React.FC<SubjectsManagerProps> = ({ subjects = [], onSave, onDelete }) => {
    const [editing, setEditing] = useState<Partial<Subject> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: Partial<Subject>) => {
        setIsSaving(true);
        const success = await onSave(data);
        if (success) {
            setEditing(null);
        }
        setIsSaving(false);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Manage Subjects</h3>
            {!editing && (
                <button
                    onClick={() => setEditing({ priority: 1, is_solo: false, can_co_run: false })}
                    className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100"
                >
                    <PlusCircleIcon className="w-5 h-5"/> Add New Subject
                </button>
            )}
            {editing && (
                <ItemForm
                    item={editing} 
                    onSave={handleSave} 
                    onCancel={() => setEditing(null)} 
                    isSaving={isSaving}
                    placeholder="Subject Name (e.g., Physics)"
                />
            )}
            <div className="space-y-2">
                {subjects.map(subject => (
                    <div key={subject.id} className="p-3 border rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-semibold">{subject.name}</p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-600">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 border">Priority: {subject.priority ?? 1}</span>
                                {subject.is_solo && (
                                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Solo slot</span>
                                )}
                                {subject.can_co_run && !subject.is_solo && (
                                    <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Can co-run</span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(subject)} className="text-sm font-semibold">Edit</button>
                            <button onClick={() => {
                                if (window.confirm('Are you sure you want to delete this subject? This action cannot be undone and may affect class assignments and student enrollments.')) {
                                    onDelete(subject.id);
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
    item: Partial<Subject>;
    onSave: (item: Partial<Subject>) => void;
    onCancel: () => void;
    isSaving: boolean;
    placeholder: string;
}> = ({ item, onSave, onCancel, isSaving, placeholder }) => {
    const [localItem, setLocalItem] = useState<Partial<Subject>>({
        priority: 1,
        is_solo: false,
        can_co_run: false,
        ...item
    });
    const [error, setError] = useState<string | null>(null);

    const toggleSolo = () => {
        setLocalItem(prev => ({
            ...prev,
            is_solo: !prev.is_solo,
            // Solo subjects cannot co-run
            can_co_run: prev.is_solo ? prev.can_co_run : false
        }));
    };

    const toggleCoRun = () => {
        setLocalItem(prev => ({
            ...prev,
            can_co_run: !prev.can_co_run,
            // Co-running subjects cannot be solo
            is_solo: prev.can_co_run ? prev.is_solo : false
        }));
    };

    const handleSave = () => {
        if (!localItem.name) {
            setError('Please enter a subject name.');
            return;
        }
        if (localItem.is_solo && localItem.can_co_run) {
            setError('A subject cannot be both Solo and Co-run.');
            return;
        }
        setError(null);
        onSave(localItem);
    };

    return (
        <div className="p-4 border rounded-lg bg-slate-500/5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                <input
                    name="name"
                    value={localItem.name || ''}
                    onChange={e => setLocalItem(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={placeholder}
                    className="p-2 border rounded"
                />
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Priority</label>
                    <input
                        type="number"
                        min={1}
                        max={10}
                        value={localItem.priority ?? 1}
                        onChange={e => setLocalItem(prev => ({ ...prev, priority: Number(e.target.value) || 1 }))}
                        className="p-2 border rounded w-24"
                    />
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={!!localItem.can_co_run && !localItem.is_solo}
                        onChange={toggleCoRun}
                    />
                    <span>Allow co-run (share time slot)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={!!localItem.is_solo}
                        onChange={toggleSolo}
                    />
                    <span>Solo (must be only subject)</span>
                </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancel}>Cancel</button>
                <button onClick={handleSave} disabled={isSaving}>{isSaving ? <Spinner size="sm"/> : 'Save'}</button>
            </div>
        </div>
    );
};

export default SubjectsManager;
