
import React, { useState, useMemo } from 'react';
import type { Term, AcademicClass, AcademicTeachingAssignment } from '../types';
import { requireSupabaseClient } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { RepeatIcon, CheckCircleIcon } from './common/icons';

interface SessionRolloverModalProps {
    isOpen: boolean;
    onClose: () => void;
    terms: Term[];
    onSuccess: () => void;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const SessionRolloverModal: React.FC<SessionRolloverModalProps> = ({ isOpen, onClose, terms, onSuccess, addToast }) => {
    const [sourceTermId, setSourceTermId] = useState<string>('');
    const [targetTermId, setTargetTermId] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [analysis, setAnalysis] = useState<{ assignmentsCount: number, classesToCreate: number } | null>(null);

    // Filter out terms to prevent selecting same source and target
    const availableSourceTerms = terms;
    const availableTargetTerms = terms.filter(t => String(t.id) !== sourceTermId);

    const handleAnalyze = async () => {
        if (!sourceTermId || !targetTermId) return;
        const supabase = requireSupabaseClient();
        setIsAnalyzing(true);
        setAnalysis(null);

        try {
            // 1. Get Source Term Details
            const sourceTerm = terms.find(t => String(t.id) === sourceTermId);
            const targetTerm = terms.find(t => String(t.id) === targetTermId);

            if (!sourceTerm || !targetTerm) throw new Error("Invalid term selection");

            // 2. Count assignments in source
            const { count, error } = await supabase
                .from('teaching_assignments')
                .select('*', { count: 'exact', head: true })
                .eq('term_id', sourceTermId);

            if (error) throw error;

            // 3. Estimate Classes to Create
            // If session labels match (intra-session rollover), we reuse classes (0 to create).
            // If session labels differ (new session), we estimate we might need to create new class containers.
            let classesEstimate = 0;
            if (sourceTerm.session_label !== targetTerm.session_label) {
                 const { count: classCount } = await supabase
                    .from('academic_classes')
                    .select('*', { count: 'exact', head: true })
                    .eq('session_label', sourceTerm.session_label);
                 classesEstimate = classCount || 0;
            }

            setAnalysis({
                assignmentsCount: count || 0,
                classesToCreate: classesEstimate
            });

        } catch (e: any) {
            addToast(e.message, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleImport = async () => {
        if (!sourceTermId || !targetTermId) return;
        setIsImporting(true);

        try {
            const supabase = requireSupabaseClient();
            const sourceTerm = terms.find(t => String(t.id) === sourceTermId)!;
            const targetTerm = terms.find(t => String(t.id) === targetTermId)!;
            const isNewSession = sourceTerm.session_label !== targetTerm.session_label;

            // 1. Fetch Source Data (Assignments + Expanded Class Info)
            const { data: sourceAssignments, error: fetchError } = await supabase
                .from('teaching_assignments')
                .select(`
                    *,
                    academic_class:academic_classes(*)
                `)
                .eq('term_id', sourceTermId);

            if (fetchError) throw fetchError;
            if (!sourceAssignments || sourceAssignments.length === 0) {
                addToast("No data found in source term to import.", "info");
                setIsImporting(false);
                return;
            }

            let createdClassesCount = 0;
            let createdAssignmentsCount = 0;

            // 2. Process
            // We need a map to store new Class IDs if we create them, to avoid duplicates
            // Key: "Level-Arm" (e.g. "JSS 1-Gold"), Value: ID
            const newClassMap = new Map<string, number>();

            // Pre-fill map with existing classes in TARGET session to avoid duplicates
            if (isNewSession) {
                const { data: existingTargetClasses } = await supabase
                    .from('academic_classes')
                    .select('id, level, arm')
                    .eq('session_label', targetTerm.session_label);
                
                existingTargetClasses?.forEach(c => {
                    newClassMap.set(`${c.level}-${c.arm}`, c.id);
                });
            }

            for (const assignment of sourceAssignments) {
                const oldClass = assignment.academic_class;
                if (!oldClass) continue;

                let targetClassId = assignment.academic_class_id;

                // If moving to a new session, we must ensure the AcademicClass exists for that session
                if (isNewSession) {
                    const classKey = `${oldClass.level}-${oldClass.arm}`;
                    
                    if (newClassMap.has(classKey)) {
                        targetClassId = newClassMap.get(classKey)!;
                    } else {
                        // Create new Academic Class for new session
                        const newClassName = `${oldClass.level}${oldClass.arm ? ` ${oldClass.arm}` : ''} (${targetTerm.session_label})`;
                        
                        const { data: newClass, error: createClassError } = await supabase
                            .from('academic_classes')
                            .insert({
                                school_id: oldClass.school_id,
                                name: newClassName,
                                level: oldClass.level,
                                arm: oldClass.arm,
                                session_label: targetTerm.session_label,
                                is_active: true,
                                assessment_structure_id: oldClass.assessment_structure_id
                            })
                            .select()
                            .single();
                        
                        if (createClassError) {
                            // If it failed because it already exists (race condition), try to fetch it
                             const { data: existing } = await supabase
                                .from('academic_classes')
                                .select('id')
                                .eq('school_id', oldClass.school_id)
                                .eq('name', newClassName)
                                .single();
                             
                             if (existing) {
                                 targetClassId = existing.id;
                                 newClassMap.set(classKey, existing.id);
                             } else {
                                 console.error("Failed to create class", createClassError);
                                 continue; // Skip this assignment
                             }
                        } else {
                            targetClassId = newClass.id;
                            newClassMap.set(classKey, newClass.id);
                            createdClassesCount++;
                        }
                    }
                }

                // Create the new Teaching Assignment
                // Check if it already exists to prevent duplicates
                const { data: existingAssignment } = await supabase
                    .from('teaching_assignments')
                    .select('id')
                    .eq('term_id', targetTermId)
                    .eq('academic_class_id', targetClassId)
                    .eq('subject_name', assignment.subject_name)
                    .maybeSingle();

                if (!existingAssignment) {
                    await supabase.from('teaching_assignments').insert({
                        school_id: assignment.school_id,
                        term_id: Number(targetTermId),
                        academic_class_id: targetClassId,
                        subject_name: assignment.subject_name,
                        subject_group: assignment.subject_group,
                        teacher_user_id: assignment.teacher_user_id,
                        max_ca_score: assignment.max_ca_score,
                        max_exam_score: assignment.max_exam_score,
                        is_locked: false
                    });
                    createdAssignmentsCount++;
                }
            }

            addToast(`Successfully imported ${createdAssignmentsCount} assignments and created ${createdClassesCount} new classes.`, "success");
            onSuccess();
            onClose();

        } catch (e: any) {
            console.error(e);
            addToast(`Import failed: ${e.message}`, 'error');
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-lg m-4">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <RepeatIcon className="w-6 h-6 text-blue-600" />
                            Import Academic Data
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Copy classes and teaching assignments from a previous term/session.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Source (Copy From)</label>
                        <select 
                            value={sourceTermId} 
                            onChange={e => { setSourceTermId(e.target.value); setAnalysis(null); }} 
                            className="w-full p-2 border rounded-md bg-white dark:bg-slate-800"
                        >
                            <option value="">Select Source Term</option>
                            {availableSourceTerms.map(t => (
                                <option key={t.id} value={t.id}>{t.session_label} - {t.term_label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target (Copy To)</label>
                        <select 
                            value={targetTermId} 
                            onChange={e => { setTargetTermId(e.target.value); setAnalysis(null); }} 
                            className="w-full p-2 border rounded-md bg-white dark:bg-slate-800"
                        >
                            <option value="">Select Target Term</option>
                            {availableTargetTerms.map(t => (
                                <option key={t.id} value={t.id}>{t.session_label} - {t.term_label}</option>
                            ))}
                        </select>
                    </div>

                    {sourceTermId && targetTermId && !analysis && (
                        <div className="pt-2">
                            <button 
                                onClick={handleAnalyze} 
                                disabled={isAnalyzing}
                                className="w-full py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 flex justify-center items-center"
                            >
                                {isAnalyzing ? <Spinner size="sm" /> : 'Analyze Data to Import'}
                            </button>
                        </div>
                    )}

                    {analysis && (
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                            <h4 className="font-semibold text-sm">Import Summary</h4>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircleIcon className="w-4 h-4 text-green-500" />
                                <span><strong>{analysis.assignmentsCount}</strong> Teaching Assignments found.</span>
                            </div>
                            {analysis.classesToCreate > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                    <RepeatIcon className="w-4 h-4 text-orange-500" />
                                    <span><strong>~{analysis.classesToCreate}</strong> New Academic Classes will be created (New Session).</span>
                                </div>
                            )}
                            {analysis.classesToCreate === 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircleIcon className="w-4 h-4 text-blue-500" />
                                    <span>Existing Academic Classes will be reused (Same Session).</span>
                                </div>
                            )}
                            <div className="mt-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 text-xs text-yellow-800 dark:text-yellow-200 rounded">
                                <strong>Note:</strong> This will append data. Existing assignments in the target term will not be deleted.
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
                    <button onClick={onClose} disabled={isImporting} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button 
                        onClick={handleImport} 
                        disabled={!analysis || isImporting || analysis.assignmentsCount === 0} 
                        className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isImporting ? <Spinner size="sm" /> : 'Start Import'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionRolloverModal;
