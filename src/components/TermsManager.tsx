
import React, { useState } from 'react';
import type { Term } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon } from './common/icons';

interface TermsManagerProps {
    terms: Term[];
    onSave: (term: Partial<Term>) => Promise<boolean>;
    onDelete: (termId: number) => Promise<boolean>;
}

const TermsManager: React.FC<TermsManagerProps> = ({ terms = [], onSave, onDelete }) => {
    const [editingTerm, setEditingTerm] = useState<Partial<Term> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (term: Partial<Term>) => {
        setIsSaving(true);
        const success = await onSave(term);
        if (success) {
            setEditingTerm(null);
        }
        setIsSaving(false);
    };

    const startNew = () => {
        setEditingTerm({});
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Manage Academic Terms</h3>
            
            {!editingTerm && (
                <button onClick={startNew} className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100">
                    <PlusCircleIcon className="w-5 h-5"/> Add New Term
                </button>
            )}

            {editingTerm && (
                <TermForm 
                    term={editingTerm} 
                    onSave={handleSave} 
                    onCancel={() => setEditingTerm(null)}
                    isSaving={isSaving} 
                />
            )}
            
            <div className="space-y-2">
                {terms.map(term => (
                    <div key={term.id} className="p-3 border rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-semibold">
                                {term.session_label} - {term.term_label}
                                {term.is_active && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>}
                            </p>
                            <p className="text-xs text-slate-500">{term.start_date} to {term.end_date}</p>
                            {term.total_school_days && <p className="text-xs text-slate-600">Total school days: {term.total_school_days}</p>}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingTerm(term)} className="text-sm font-semibold">Edit</button>
                            <button onClick={() => {
                                if (window.confirm('Are you sure you want to delete this term? This action cannot be undone and may affect related academic classes and assignments.')) {
                                    onDelete(term.id);
                                }
                            }} className="text-sm font-semibold text-red-600">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TermForm: React.FC<{
    term: Partial<Term>;
    onSave: (term: Partial<Term>) => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ term, onSave, onCancel, isSaving }) => {
    const [localTerm, setLocalTerm] = useState(term);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLocalTerm(prev => ({...prev, [name]: type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? null : Number(value)) : value)}));
    };
    
    return (
        <div className="p-4 border rounded-lg bg-slate-500/5 space-y-3">
            <div className="grid grid-cols-2 gap-4">
                <input name="session_label" value={localTerm.session_label || ''} onChange={handleChange} placeholder="Session (e.g., 2024/2025)" className="p-2 border rounded"/>
                <input name="term_label" value={localTerm.term_label || ''} onChange={handleChange} placeholder="Term (e.g., First Term)" className="p-2 border rounded"/>
                <input name="start_date" type="date" value={localTerm.start_date || ''} onChange={handleChange} className="p-2 border rounded"/>
                <input name="end_date" type="date" value={localTerm.end_date || ''} onChange={handleChange} className="p-2 border rounded"/>
                <input name="total_school_days" type="number" value={localTerm.total_school_days ?? ''} onChange={handleChange} placeholder="Total school days in term" className="p-2 border rounded" min="0"/>
                <div className="flex items-center gap-2 p-2">
                    <input name="is_active" type="checkbox" checked={localTerm.is_active || false} onChange={handleChange} id="is_active_checkbox" className="w-4 h-4"/>
                    <label htmlFor="is_active_checkbox" className="text-sm font-medium cursor-pointer">Set as Active Term</label>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel}>Cancel</button>
                <button onClick={() => onSave(localTerm)} disabled={isSaving}>{isSaving ? <Spinner size="sm"/> : 'Save'}</button>
            </div>
        </div>
    );
};

export default TermsManager;
