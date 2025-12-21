
import React, { useState, useEffect } from 'react';
import type { GradingScheme, GradingSchemeRule, SchoolConfig } from '../types';
import Spinner from './common/Spinner';
import { TrashIcon, PlusCircleIcon, RefreshIcon } from './common/icons';
import { requireSupabaseClient } from '../services/supabaseClient';

interface GradingSchemeFormProps {
    scheme: Partial<GradingScheme>;
    onSave: (scheme: Partial<GradingScheme>) => Promise<void>;
    onCancel: () => void;
}

const GradingSchemeForm: React.FC<GradingSchemeFormProps> = ({ scheme: initialScheme, onSave, onCancel }) => {
    const [scheme, setScheme] = useState<Partial<GradingScheme>>(initialScheme);
    const [isSaving, setIsSaving] = useState(false);

    const handleSchemeChange = (field: keyof GradingScheme, value: any) => {
        setScheme(prev => ({...prev, [field]: value}));
    };

    const handleRuleChange = (index: number, field: keyof GradingSchemeRule, value: any) => {
        const newRules = [...(scheme.rules || [])];
        newRules[index] = {...newRules[index], [field]: value};
        setScheme(prev => ({...prev, rules: newRules}));
    };

    const addRule = () => {
        const newRule: Partial<GradingSchemeRule> = { min_score: 0, max_score: 0, grade_label: '' };
        setScheme(prev => ({...prev, rules: [...(prev.rules || []), newRule] as GradingSchemeRule[]}));
    };

    const removeRule = (index: number) => {
        setScheme(prev => ({...prev, rules: (prev.rules || []).filter((_, i) => i !== index)}));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(scheme);
        setIsSaving(false);
    };
    
    return (
        <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-slate-500/5 space-y-4">
            <h3 className="font-bold text-lg">{scheme.id ? 'Edit' : 'Create'} Grading Scheme</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Scheme Name" value={scheme.scheme_name || ''} onChange={e => handleSchemeChange('scheme_name', e.target.value)} required className="w-full p-2 border rounded"/>
                <input type="number" step="0.1" placeholder="Max GPA (e.g., 4.0)" value={scheme.gpa_max || ''} onChange={e => handleSchemeChange('gpa_max', Number(e.target.value))} className="w-full p-2 border rounded"/>
            </div>
            <div className="flex justify-between items-center">
                <h4 className="font-semibold">Rules</h4>
                <button type="button" onClick={addRule} className="text-sm flex items-center gap-2 font-semibold text-blue-600"><PlusCircleIcon className="w-5 h-5"/> Add Rule</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {(scheme.rules || []).map((rule, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <input type="number" placeholder="Min %" value={rule.min_score ?? ''} onChange={e => handleRuleChange(index, 'min_score', Number(e.target.value))} className="col-span-2 p-1 border rounded" />
                        <input type="number" placeholder="Max %" value={rule.max_score ?? ''} onChange={e => handleRuleChange(index, 'max_score', Number(e.target.value))} className="col-span-2 p-1 border rounded" />
                        <input type="text" placeholder="Grade" value={rule.grade_label || ''} onChange={e => handleRuleChange(index, 'grade_label', e.target.value)} className="col-span-2 p-1 border rounded" />
                        <input type="number" step="0.01" placeholder="GPA" value={rule.gpa_value ?? ''} onChange={e => handleRuleChange(index, 'gpa_value', e.target.value ? Number(e.target.value) : null)} className="col-span-2 p-1 border rounded" />
                        <input type="text" placeholder="Remark" value={rule.remark || ''} onChange={e => handleRuleChange(index, 'remark', e.target.value)} className="col-span-3 p-1 border rounded" />
                        <button type="button" onClick={() => removeRule(index)} className="text-red-500"><TrashIcon className="w-4 h-4"/></button>
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md">{isSaving ? <Spinner size="sm" /> : 'Save Scheme'}</button>
            </div>
        </form>
    );
};


interface GradingSchemeManagerProps {
    gradingSchemes: GradingScheme[];
    schoolConfig: SchoolConfig | null;
    onSaveScheme: (scheme: Partial<GradingScheme>) => Promise<boolean>;
    onDeleteScheme: (schemeId: number) => Promise<boolean>;
    onSetActiveScheme: (schemeId: number) => Promise<boolean>;
    onSaveSchoolConfig: (config: Partial<SchoolConfig>) => Promise<boolean>;
    addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const GradingSchemeManager: React.FC<GradingSchemeManagerProps> = ({ gradingSchemes = [], schoolConfig, onSaveScheme, onDeleteScheme, onSetActiveScheme, onSaveSchoolConfig, addToast }) => {
    const [editingScheme, setEditingScheme] = useState<Partial<GradingScheme> | null>(null);
    const [termWeights, setTermWeights] = useState<{ term1: number; term2: number; term3: number }>({ term1: 10, term2: 10, term3: 80 });
    const [isSavingWeights, setIsSavingWeights] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [showRecalculateModal, setShowRecalculateModal] = useState(false);
    const [schemeToRecalculate, setSchemeToRecalculate] = useState<number | null>(null);

    useEffect(() => {
        if (schoolConfig?.term_weights) {
            setTermWeights(schoolConfig.term_weights);
        }
    }, [schoolConfig]);

    const handleSave = async (scheme: Partial<GradingScheme>) => {
        const success = await onSaveScheme(scheme);
        if (success) {
            setEditingScheme(null);
            // Prompt user to recalculate grades after saving
            if (scheme.id && addToast) {
                const shouldRecalculate = window.confirm(
                    'Grading scheme saved successfully! Would you like to recalculate all grades using this scheme?'
                );
                if (shouldRecalculate) {
                    setSchemeToRecalculate(scheme.id);
                    setShowRecalculateModal(true);
                }
            }
        }
    };
    
    const handleRecalculateGrades = async () => {
        if (!schemeToRecalculate) return;
        
        setShowRecalculateModal(false);
        setIsRecalculating(true);
        const supabase = requireSupabaseClient();
        
        try {
            if (addToast) {
                addToast('Recalculating all grades...', 'info');
            }
            
            const { data, error } = await supabase.rpc('recalculate_all_grades', {
                p_grading_scheme_id: schemeToRecalculate,
                p_term_id: null // Recalculate for all terms
            });
            
            if (error) throw error;
            
            const updatedCount = data?.updated_count || 0;
            if (addToast) {
                addToast(`Successfully recalculated ${updatedCount} grade${updatedCount !== 1 ? 's' : ''}!`, 'success');
            }
        } catch (e: any) {
            console.error('Recalculate grades error:', e);
            if (addToast) {
                addToast(`Failed to recalculate grades: ${e.message}`, 'error');
            }
        } finally {
            setIsRecalculating(false);
            setSchemeToRecalculate(null);
        }
    };

    const handleSaveWeights = async () => {
        setIsSavingWeights(true);
        await onSaveSchoolConfig({ term_weights: termWeights });
        setIsSavingWeights(false);
    };
    
    const handleWeightChange = (term: keyof typeof termWeights, value: number) => {
        setTermWeights(prev => ({ ...prev, [term]: value }));
    }
    
    const totalWeight = termWeights.term1 + termWeights.term2 + termWeights.term3;
    
    return (
        <div className="space-y-8">
             {/* Term Weighting Section */}
             <div className="p-4 border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800 rounded-xl">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Composite Result Weighting</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Set the percentage weight for each term when calculating cumulative results (must sum to 100%).</p>
                <div className="grid grid-cols-3 gap-4 max-w-lg">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">1st Term (%)</label>
                        <input type="number" value={termWeights.term1} onChange={e => handleWeightChange('term1', Number(e.target.value))} className="w-full p-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">2nd Term (%)</label>
                        <input type="number" value={termWeights.term2} onChange={e => handleWeightChange('term2', Number(e.target.value))} className="w-full p-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">3rd Term (%)</label>
                        <input type="number" value={termWeights.term3} onChange={e => handleWeightChange('term3', Number(e.target.value))} className="w-full p-2 border rounded-md" />
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                    <p className={`text-sm font-semibold ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>Total: {totalWeight}%</p>
                    <button onClick={handleSaveWeights} disabled={isSavingWeights || totalWeight !== 100} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold disabled:opacity-50">
                        {isSavingWeights ? <Spinner size="sm" /> : 'Save Weights'}
                    </button>
                </div>
             </div>

            {/* Grading Schemes Section */}
            <div className="space-y-4">
                {editingScheme ? (
                    <GradingSchemeForm scheme={editingScheme} onSave={handleSave} onCancel={() => setEditingScheme(null)} />
                ) : (
                    <button onClick={() => setEditingScheme({ rules: [] })} className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100">
                        <PlusCircleIcon className="w-5 h-5"/> Create New Grading Scheme
                    </button>
                )}

                <div className="space-y-3">
                    {gradingSchemes.map(scheme => (
                        <div key={scheme.id} className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold">{scheme.scheme_name}</h4>
                                    {schoolConfig?.active_grading_scheme_id === scheme.id && <span className="text-xs font-semibold px-2 py-0.5 bg-green-200 text-green-800 rounded-full">Active</span>}
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            setSchemeToRecalculate(scheme.id);
                                            setShowRecalculateModal(true);
                                        }}
                                        disabled={isRecalculating}
                                        className="text-sm font-semibold text-purple-600 flex items-center gap-1 hover:text-purple-700 disabled:opacity-50"
                                        title="Recalculate all grades using this scheme"
                                    >
                                        <RefreshIcon className="w-4 h-4" />
                                        Recalculate
                                    </button>
                                    {schoolConfig?.active_grading_scheme_id !== scheme.id && <button onClick={() => onSetActiveScheme(scheme.id)} className="text-sm font-semibold text-green-600">Set Active</button>}
                                    <button onClick={() => setEditingScheme(scheme)} className="text-sm font-semibold">Edit</button>
                                    <button onClick={() => {
                                        if (window.confirm('Are you sure you want to delete this grading scheme? This action cannot be undone and may affect student grades and reports.')) {
                                            onDeleteScheme(scheme.id);
                                        }
                                    }} className="text-sm font-semibold text-red-600">Delete</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Recalculate Grades Confirmation Modal */}
            {showRecalculateModal && schemeToRecalculate && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in"
                    aria-modal="true"
                    role="dialog"
                >
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                            Recalculate All Grades
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                            This will recalculate all grades across all terms for students using the <span className="font-semibold">{gradingSchemes.find(s => s.id === schemeToRecalculate)?.scheme_name}</span> grading scheme.
                        </p>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            Subject-specific overrides will be applied where configured.
                        </p>
                        <p className="text-sm text-amber-600 dark:text-amber-400 mb-6 flex items-start gap-2">
                            <span className="text-lg">⚠️</span>
                            <span>This will update all existing grades. Make sure the grading scheme is correct before proceeding.</span>
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowRecalculateModal(false);
                                    setSchemeToRecalculate(null);
                                }}
                                disabled={isRecalculating}
                                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRecalculateGrades}
                                disabled={isRecalculating}
                                className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {isRecalculating ? (
                                    <>
                                        <Spinner size="sm" />
                                        Recalculating...
                                    </>
                                ) : (
                                    'Recalculate Grades'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GradingSchemeManager;
