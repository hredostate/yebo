
import React, { useState } from 'react';
import type { AssessmentStructure, AssessmentComponent, SchoolConfig, ReportCardConfig } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, TrashIcon, ShieldIcon } from './common/icons';

interface AssessmentStructureManagerProps {
    structures: AssessmentStructure[];
    onSave: (structure: Partial<AssessmentStructure>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
    schoolConfig: SchoolConfig | null;
}

const ResultSheetPreview: React.FC<{ structure: Partial<AssessmentStructure>; schoolConfig: SchoolConfig | null }> = ({ structure, schoolConfig }) => {
    // Use generic styles as we don't have specific class config here
    const themeColor = '#1E3A8A'; 
    const showPhoto = true;
    
    const components = structure.components || []; // Safe default
    const totalScore = components.reduce((sum, comp) => sum + (Number(comp.max_score) || 0), 0);

    return (
        <div className="border bg-white shadow-xl text-[10px] w-full mx-auto rounded-sm overflow-hidden" style={{ borderTop: `4px solid ${themeColor}` }}>
            {/* Header */}
            <div className="p-3 flex gap-3 items-center border-b border-slate-200">
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center shrink-0 border border-slate-200">
                    {schoolConfig?.logo_url ? <img src={schoolConfig.logo_url} className="w-8 h-8 object-contain"/> : <ShieldIcon className="w-6 h-6 text-slate-400"/>}
                </div>
                <div className="flex-grow">
                    <h1 className="font-bold text-xs text-slate-800 uppercase leading-tight">{schoolConfig?.display_name || 'SCHOOL NAME'}</h1>
                    <p className="text-slate-500 text-[9px] leading-tight">{schoolConfig?.address || 'School Address'}</p>
                    <p className="text-slate-400 text-[9px] uppercase mt-0.5 font-semibold" style={{ color: themeColor }}>Term Report Card</p>
                </div>
                {showPhoto && (
                    <div className="w-10 h-12 bg-slate-100 border border-slate-300 flex items-center justify-center text-[8px] text-slate-400 text-center leading-none">
                        STUDENT PHOTO
                    </div>
                )}
            </div>
            
            {/* Student Info Placeholder */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-x-2 gap-y-1 text-slate-600">
                <div>Name: <strong className="text-slate-900">John Doe</strong></div>
                <div>Class: <strong className="text-slate-900">JSS 1 Gold</strong></div>
                <div>Average: <strong className="text-slate-900">85.4%</strong></div>
                <div>Position: <strong className="text-slate-900">5th</strong></div>
            </div>

            {/* Scores Table */}
            <div className="p-2">
                <table className="w-full border-collapse border border-slate-300">
                    <thead className="bg-slate-100 text-slate-700">
                        <tr>
                            <th className="border border-slate-300 p-1 text-left font-semibold">Subject</th>
                            {(components || []).map((c, i) => (
                                <th key={i} className="border border-slate-300 p-1 text-center w-8 font-semibold leading-tight">
                                    {c.name}
                                    <br/>
                                    <span className="text-[8px] text-slate-400 font-normal">/{c.max_score}</span>
                                </th>
                            ))}
                            <th className="border border-slate-300 p-1 text-center w-8 font-bold">Total</th>
                            <th className="border border-slate-300 p-1 text-center w-8 font-bold">Pos</th>
                            <th className="border border-slate-300 p-1 text-center w-8 font-bold">Grade</th>
                            <th className="border border-slate-300 p-1 text-left font-semibold">Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['Mathematics', 'English', 'Basic Science'].map((subj, idx) => (
                            <tr key={idx}>
                                <td className="border border-slate-300 p-1 font-medium text-slate-800">{subj}</td>
                                {(components || []).map((c, i) => (
                                    <td key={i} className="border border-slate-300 p-1 text-center text-slate-500">-</td>
                                ))}
                                <td className="border border-slate-300 p-1 text-center font-bold bg-slate-50">-</td>
                                <td className="border border-slate-300 p-1 text-center text-[9px] text-slate-500">1st</td>
                                <td className="border border-slate-300 p-1 text-center font-bold">-</td>
                                <td className="border border-slate-300 p-1 text-[9px] italic text-slate-500">Excellent result.</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className={`mt-2 text-center text-[9px] font-semibold ${totalScore === 100 ? 'text-green-600' : 'text-red-500'}`}>
                    Current Total: {totalScore} {totalScore !== 100 && '(Target: 100)'}
                </div>
            </div>

            {/* Comments */}
            <div className="px-2 pb-2 grid grid-cols-2 gap-2">
                <div className="border border-slate-300 p-1.5 rounded">
                    <p className="font-bold text-slate-700 text-[9px] border-b border-slate-200 mb-1 pb-0.5">Class Teacher</p>
                    <p className="italic text-slate-500 h-3 text-[9px]">A focused student...</p>
                </div>
                <div className="border border-slate-300 p-1.5 rounded">
                    <p className="font-bold text-slate-700 text-[9px] border-b border-slate-200 mb-1 pb-0.5">Principal</p>
                    <p className="italic text-slate-500 h-3 text-[9px]">Keep it up.</p>
                </div>
            </div>
            
            {/* Footer */}
            <div className="bg-slate-800 text-white text-center py-1 text-[8px]">
                Powered by School Guardian 360
            </div>
        </div>
    )
}

const AssessmentStructureManager: React.FC<AssessmentStructureManagerProps> = ({ structures = [], onSave, onDelete, schoolConfig }) => {
    const [editing, setEditing] = useState<Partial<AssessmentStructure> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: Partial<AssessmentStructure>) => {
        setIsSaving(true);
        const success = await onSave(data);
        if (success) {
            setEditing(null);
        }
        setIsSaving(false);
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Report Card Grading Templates</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    <strong>Source of Truth:</strong> These templates define the official columns (e.g., CA1, CA2, Exam) that appear on the Student Report Cards.
                </p>
            </div>
            {!editing && (
                <button onClick={() => setEditing({ name: '', components: [{ name: 'CA1', max_score: 20 }, { name: 'Exam', max_score: 80 }] })} className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100">
                    <PlusCircleIcon className="w-5 h-5"/> Add New Template
                </button>
            )}
            {editing && (
                <AssessmentStructureForm 
                    structure={editing} 
                    onSave={handleSave} 
                    onCancel={() => setEditing(null)} 
                    isSaving={isSaving}
                    schoolConfig={schoolConfig} 
                />
            )}
            <div className="space-y-2">
                {structures.map(structure => (
                    <div key={structure.id} className="p-3 border rounded-lg flex justify-between items-center bg-white dark:bg-slate-900">
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-white">{structure.name}</p>
                            <p className="text-xs text-slate-500">
                                Columns: {(structure.components || []).map(c => `${c.name} (${c.max_score})`).join(' + ')}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(structure)} className="text-sm font-semibold text-blue-600 hover:underline">Edit</button>
                            <button onClick={() => {
                                if (window.confirm('Are you sure you want to delete this assessment structure? This action cannot be undone and may affect related academic classes and student assessments.')) {
                                    onDelete(structure.id);
                                }
                            }} className="text-sm font-semibold text-red-600 hover:underline">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AssessmentStructureForm: React.FC<{
    structure: Partial<AssessmentStructure>;
    onSave: (structure: Partial<AssessmentStructure>) => void;
    onCancel: () => void;
    isSaving: boolean;
    schoolConfig: SchoolConfig | null;
}> = ({ structure: initialStructure, onSave, onCancel, isSaving, schoolConfig }) => {
    const [structure, setStructure] = useState<Partial<AssessmentStructure>>(initialStructure);
    
    const handleComponentChange = (index: number, field: keyof AssessmentComponent, value: string) => {
        const newComponents = [...(structure.components || [])];
        const numValue = field === 'max_score' ? Number(value) : value;
        (newComponents[index] as any)[field] = numValue;
        setStructure(prev => ({ ...prev, components: newComponents }));
    };

    const addComponent = () => {
        const newComponents = [...(structure.components || []), { name: '', max_score: 10 }];
        setStructure(prev => ({...prev, components: newComponents}));
    };

    const removeComponent = (index: number) => {
        const newComponents = (structure.components || []).filter((_, i) => i !== index);
        setStructure(prev => ({...prev, components: newComponents}));
    };
    
    const applyTemplate = (type: 'jss' | 'sss' | 'primary') => {
        let components: AssessmentComponent[] = [];
        let name = '';
        if (type === 'jss') {
            name = 'JSS Standard (40/60)';
            components = [
                { name: 'CA 1', max_score: 10 },
                { name: 'CA 2', max_score: 10 },
                { name: 'CA 3', max_score: 20 },
                { name: 'Exam', max_score: 60 }
            ];
        } else if (type === 'sss') {
             name = 'SSS Standard (30/70)';
             components = [
                { name: 'CA', max_score: 30 },
                { name: 'Exam', max_score: 70 }
            ];
        } else if (type === 'primary') {
             name = 'Primary Standard';
             components = [
                { name: 'Test 1', max_score: 20 },
                { name: 'Test 2', max_score: 20 },
                { name: 'Exam', max_score: 60 }
            ];
        }
        setStructure(prev => ({ ...prev, name, components }));
    };
    
    const totalScore = (structure.components || []).reduce((sum, comp) => sum + (Number(comp.max_score) || 0), 0);

    return (
        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 space-y-4 animate-fade-in">
            <h4 className="font-bold text-lg text-slate-800 dark:text-white">{structure.id ? 'Edit' : 'Create'} Structure</h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Input Form */}
                <div className="space-y-4">
                     <input 
                        type="text" 
                        placeholder="Structure Name (e.g., Standard CA/Exam)" 
                        value={structure.name || ''}
                        onChange={e => setStructure(prev => ({...prev, name: e.target.value}))}
                        className="w-full p-2 border rounded bg-white dark:bg-slate-800 dark:border-slate-600"
                        required
                    />
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase w-full">One-Click Templates</span>
                        <button type="button" onClick={() => applyTemplate('jss')} className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200">Junior Secondary (JSS)</button>
                        <button type="button" onClick={() => applyTemplate('sss')} className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200">Senior Secondary (SSS)</button>
                        <button type="button" onClick={() => applyTemplate('primary')} className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200">Primary</button>
                    </div>
                    
                    <div className="flex justify-between items-center">
                         <h5 className="font-semibold text-sm">Columns</h5>
                         <button type="button" onClick={addComponent} className="text-sm flex items-center gap-1 text-blue-600 font-semibold hover:underline"><PlusCircleIcon className="w-4 h-4" /> Add Column</button>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {(structure.components || []).map((comp, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input type="text" placeholder="Name (e.g., CA1)" value={comp.name} onChange={e => handleComponentChange(index, 'name', e.target.value)} className="p-1.5 text-sm border rounded flex-grow bg-white dark:bg-slate-800 dark:border-slate-600"/>
                                <input type="number" placeholder="Max" value={comp.max_score} onChange={e => handleComponentChange(index, 'max_score', e.target.value)} className="p-1.5 text-sm border rounded w-20 text-center bg-white dark:bg-slate-800 dark:border-slate-600"/>
                                <button type="button" onClick={() => removeComponent(index)} className="text-red-500 hover:bg-red-100 rounded p-1"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                    
                    <div className={`p-2 rounded-md text-sm font-semibold text-center ${totalScore === 100 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        Total Score: {totalScore} {totalScore !== 100 && '(Should sum to 100%)'}
                    </div>
                </div>

                {/* Right: Live Preview */}
                <div className="hidden lg:block border-l pl-6 border-slate-200 dark:border-slate-700">
                    <h5 className="font-semibold text-sm text-slate-500 uppercase mb-3">Live Result Sheet Preview</h5>
                    <ResultSheetPreview structure={structure} schoolConfig={schoolConfig} />
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-md">Cancel</button>
                <button onClick={() => onSave(structure)} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2">{isSaving && <Spinner size="sm"/>} Save Template</button>
            </div>
        </div>
    );
};

export default AssessmentStructureManager;
