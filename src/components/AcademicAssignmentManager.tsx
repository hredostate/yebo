
import React, { useState, useMemo, useEffect } from 'react';
import type { AcademicTeachingAssignment, Term, AcademicClass, UserProfile, BaseDataObject, TeachingAssignment } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, SearchIcon, TrashIcon, EditIcon, RepeatIcon } from './common/icons';
import SearchableSelect from './common/SearchableSelect';
import { SUBJECT_OPTIONS } from '../constants';

interface AcademicAssignmentManagerProps {
    assignments: AcademicTeachingAssignment[];
    terms: Term[];
    academicClasses: AcademicClass[];
    users: UserProfile[];
    onSave: (as: Partial<AcademicTeachingAssignment>) => Promise<boolean>;
    onDelete: (asId: number) => Promise<boolean>;
    classes: BaseDataObject[]; // Base classes from DB
    arms: BaseDataObject[];    // Base arms from DB
    subjects: BaseDataObject[]; // Base subjects from DB
    teachingEntities?: TeachingAssignment[];
    onImportLegacyAssignments?: (termId: number, entityIds: number[]) => Promise<boolean>;
}

const ImportLegacyModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    teachingEntities: TeachingAssignment[];
    currentTermId: number;
    existingAssignments: AcademicTeachingAssignment[];
    onImport: (termId: number, entityIds: number[]) => Promise<boolean>;
}> = ({ isOpen, onClose, teachingEntities, currentTermId, existingAssignments, onImport }) => {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isImporting, setIsImporting] = useState(false);

    const availableEntities = useMemo(() => {
        // Create a set of unique keys for existing assignments to avoid duplicates
        // Format: subject-teacher-level-arm (lowercase, trimmed)
        const existingSet = new Set(existingAssignments.map(a => {
            const subj = (a.subject_name || '').trim().toLowerCase();
            const teacher = (a.teacher_user_id || '').trim(); // User IDs are UUIDs, case sensitive but trimming is safe
            const level = (a.academic_class?.level || '').trim().toLowerCase();
            const arm = (a.academic_class?.arm || '').trim().toLowerCase();
            return `${subj}-${teacher}-${level}-${arm}`;
        }));

        return teachingEntities.filter(te => {
            // Safely construct the key for the potential import
            const subj = (te.subject?.name || '').trim().toLowerCase();
            const teacher = (te.user_id || '').trim();
            const level = (te.class?.name || '').trim().toLowerCase();
            const arm = (te.arm?.name || '').trim().toLowerCase();
            
            // Skip if critical info is missing
            if (!subj || !teacher || !level) return false;

            const key = `${subj}-${teacher}-${level}-${arm}`;
            return !existingSet.has(key);
        });
    }, [teachingEntities, existingAssignments]);

    const handleToggle = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };
    
    const handleSelectAll = () => {
        if (selectedIds.size === availableEntities.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(availableEntities.map(e => e.id)));
        }
    }

    const handleImport = async () => {
        if (!currentTermId) {
            alert("Please select a target term using the filter dropdown before importing.");
            return;
        }

        setIsImporting(true);
        try {
            await onImport(currentTermId, Array.from(selectedIds));
        } catch (error) {
            console.error("Import failed in modal:", error);
        } finally {
            setIsImporting(false);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Import from Staff Allocation</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                    Select assignments from the Staff List to create grading records for the current term.
                    Any missing academic classes will be automatically created.
                </p>
                
                <div className="flex justify-between mb-2">
                    <button onClick={handleSelectAll} className="text-sm text-blue-600 font-semibold hover:underline">
                        {selectedIds.size === availableEntities.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-sm text-slate-500">{selectedIds.size} selected</span>
                </div>

                <div className="flex-grow overflow-y-auto border rounded-md p-2 space-y-2 bg-slate-50 dark:bg-slate-900/50">
                    {availableEntities.length === 0 ? <p className="text-center text-slate-500 py-8">No new unique assignments found to import for this term.</p> : 
                    availableEntities.map(te => (
                        <label key={te.id} className="flex items-center p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer transition-colors">
                            <input type="checkbox" checked={selectedIds.has(te.id)} onChange={() => handleToggle(te.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mr-3" />
                            <div>
                                <p className="font-semibold text-sm text-slate-800 dark:text-white">{te.subject?.name} - {te.class?.name} {te.arm?.name}</p>
                                <p className="text-xs text-slate-500">{te.teacher?.name}</p>
                            </div>
                        </label>
                    ))}
                </div>
                
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 dark:bg-slate-700 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Cancel</button>
                    <button onClick={handleImport} disabled={isImporting || selectedIds.size === 0} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2">
                        {isImporting ? <Spinner size="sm" /> : `Import ${selectedIds.size}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AcademicAssignmentManager: React.FC<AcademicAssignmentManagerProps> = ({ assignments = [], terms = [], academicClasses = [], users = [], onSave, onDelete, teachingEntities = [], onImportLegacyAssignments, classes = [], arms = [] }) => {
    const [editingAssignment, setEditingAssignment] = useState<Partial<AcademicTeachingAssignment> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Persistent Term Selection
    const [selectedTermId, setSelectedTermId] = useState<number | ''>(() => {
        const saved = localStorage.getItem('sac_selectedTermId');
        return saved ? Number(saved) : '';
    });

    useEffect(() => {
        if (selectedTermId) {
            localStorage.setItem('sac_selectedTermId', String(selectedTermId));
        }
    }, [selectedTermId]);

    const teachers = useMemo(() => users.filter(u => u.role === 'Teacher' || u.role === 'Team Lead' || u.role === 'Admin' || u.role === 'Principal').sort((a,b) => a.name.localeCompare(b.name)), [users]);
    
    useEffect(() => {
        if (selectedTermId === '' && terms.length > 0) {
            const activeTerm = terms.find(t => t.is_active);
            if (activeTerm) setSelectedTermId(activeTerm.id);
            else setSelectedTermId(terms[0].id);
        }
    }, [terms, selectedTermId]);

    const filteredAssignments = useMemo(() => {
        let data = assignments;
        if (selectedTermId) {
            data = data.filter(a => a.term_id === selectedTermId);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(a => 
                a.subject_name.toLowerCase().includes(q) ||
                a.teacher?.name.toLowerCase().includes(q) ||
                a.academic_class?.name.toLowerCase().includes(q)
            );
        }
        return data.sort((a, b) => (a.academic_class?.name || '').localeCompare(b.academic_class?.name || ''));
    }, [selectedTermId, assignments, searchQuery]);

    const handleSave = async (as: Partial<AcademicTeachingAssignment>) => {
        setIsSaving(true);
        const success = await onSave(as);
        if (success) {
            setEditingAssignment(null);
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: number) => {
        if(window.confirm('Are you sure you want to delete this assignment? Scores associated with it might be orphaned.')) {
            await onDelete(id);
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                     <h3 className="text-lg font-bold text-slate-800 dark:text-white">Teaching Assignments</h3>
                     <p className="text-sm text-slate-500 dark:text-slate-400">Assign subjects to teachers for specific classes.</p>
                </div>
                <div className="flex gap-2">
                    {onImportLegacyAssignments && teachingEntities.length > 0 && (
                        <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 font-semibold rounded-lg hover:bg-slate-300 transition-colors shadow-sm text-sm">
                            <RepeatIcon className="w-4 h-4"/> Import from Staff List
                        </button>
                    )}
                    {!editingAssignment && (
                        <button onClick={() => setEditingAssignment({ term_id: selectedTermId ? Number(selectedTermId) : undefined })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm">
                            <PlusCircleIcon className="w-4 h-4"/> New Assignment
                        </button>
                    )}
                </div>
            </div>
            
            {editingAssignment ? (
                <AssignmentForm
                    assignment={editingAssignment}
                    onSave={handleSave}
                    onCancel={() => setEditingAssignment(null)}
                    isSaving={isSaving}
                    terms={terms}
                    academicClasses={academicClasses}
                    teachers={teachers}
                    classes={classes}
                    arms={arms}
                />
            ) : (
                <div className="rounded-xl border border-slate-200/60 bg-white/60 dark:border-slate-700/60 dark:bg-slate-900/40 backdrop-blur-sm shadow-sm">
                    <div className="p-4 border-b border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row gap-4">
                         <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Filter by Term</label>
                            <select 
                                value={selectedTermId} 
                                onChange={e => setSelectedTermId(e.target.value === '' ? '' : Number(e.target.value))} 
                                className="w-full p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Terms</option>
                                {terms.map(t => <option key={t.id} value={t.id}>{t.session_label} - {t.term_label}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                             <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
                             <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                    placeholder="Search subject, teacher, or class..." 
                                    className="w-full pl-9 p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm focus:ring-2 focus:ring-blue-500"
                                />
                             </div>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-slate-50/50 dark:bg-slate-800/50 text-slate-500">
                                <tr>
                                    <th className="px-6 py-3">Class</th>
                                    <th className="px-6 py-3">Subject</th>
                                    <th className="px-6 py-3">Teacher</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                                {filteredAssignments.length > 0 ? filteredAssignments.map(as => (
                                    <tr key={as.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{as.academic_class?.name}</td>
                                        <td className="px-6 py-3">{as.subject_name}</td>
                                        <td className="px-6 py-3 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                                {as.teacher?.name.charAt(0)}
                                            </div>
                                            {as.teacher?.name}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => { setSelectedTermId(as.term_id); setEditingAssignment(as); }} className="text-slate-500 hover:text-blue-600 transition-colors" title="Edit">
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(as.id)} className="text-slate-500 hover:text-red-600 transition-colors" title="Delete">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No assignments found matching your criteria.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 border-t border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-500 text-center">
                        Showing {filteredAssignments.length} records
                    </div>
                </div>
            )}

            {isImportModalOpen && onImportLegacyAssignments && teachingEntities && (
                <ImportLegacyModal 
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    teachingEntities={teachingEntities}
                    currentTermId={Number(selectedTermId)}
                    existingAssignments={filteredAssignments}
                    onImport={onImportLegacyAssignments}
                />
            )}
        </div>
    );
};

const AssignmentForm: React.FC<{
    assignment: Partial<AcademicTeachingAssignment>;
    onSave: (as: Partial<AcademicTeachingAssignment>) => void;
    onCancel: () => void;
    isSaving: boolean;
    terms: Term[];
    academicClasses: AcademicClass[];
    teachers: UserProfile[];
    classes: BaseDataObject[];
    arms: BaseDataObject[];
}> = ({ assignment, onSave, onCancel, isSaving, terms, academicClasses, teachers, classes, arms }) => {
    const [localAs, setLocalAs] = useState(assignment);
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    const [selectedArms, setSelectedArms] = useState<Set<string>>(new Set());
    const [bulkMode, setBulkMode] = useState(false);

    useEffect(() => {
        if (assignment.academic_class_id) {
            const ac = academicClasses.find(c => c.id === assignment.academic_class_id);
            if (ac) {
                setSelectedLevel(ac.level || '');
                setSelectedArms(new Set([ac.arm || '']));
                setBulkMode(false);
            }
        } else {
            setSelectedLevel('');
            setSelectedArms(new Set());
        }
    }, [assignment.academic_class_id, academicClasses]);

    // For single arm mode (editing), update academic_class_id
    useEffect(() => {
        if (!bulkMode && localAs.term_id && selectedLevel) {
             const selectedTerm = terms.find(t => t.id === Number(localAs.term_id));
             const selectedArm = Array.from(selectedArms)[0] || '';
             if (selectedTerm) {
                 const ac = academicClasses.find(c => 
                    c.session_label === selectedTerm.session_label &&
                    c.level === selectedLevel &&
                    (c.arm === selectedArm || (!c.arm && !selectedArm))
                 );
                 if (ac) {
                     setLocalAs(prev => ({ ...prev, academic_class_id: ac.id }));
                 } else {
                     setLocalAs(prev => ({ ...prev, academic_class_id: undefined }));
                 }
             }
        } else {
             setLocalAs(prev => ({ ...prev, academic_class_id: undefined }));
        }
    }, [bulkMode, localAs.term_id, selectedLevel, selectedArms, academicClasses, terms]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setLocalAs(prev => ({ ...prev, [name]: value }));
    };
    
    const handleTeacherSelect = (value: string | number) => {
        setLocalAs(prev => ({ ...prev, teacher_user_id: String(value) }));
    }
    
    const handleSubjectSelect = (value: string | number) => {
        setLocalAs(prev => ({ ...prev, subject_name: String(value) }));
    }
    
    const handleSave = async () => {
        if (bulkMode && selectedLevel && localAs.term_id) {
            // Bulk save: create assignments for multiple arms
            const selectedTerm = terms.find(t => t.id === Number(localAs.term_id));
            if (!selectedTerm) return;
            
            const armsToCreate = selectedArms.size > 0 ? Array.from(selectedArms) : [''];
            
            for (const armName of armsToCreate) {
                // Find or identify the academic class for this arm
                const ac = academicClasses.find(c => 
                    c.session_label === selectedTerm.session_label &&
                    c.level === selectedLevel &&
                    (c.arm === armName || (!c.arm && !armName))
                );
                
                if (ac) {
                    await onSave({
                        ...localAs,
                        academic_class_id: ac.id
                    });
                }
            }
        } else {
            // Single save
            onSave(localAs);
        }
    };
    
    const subjectOptions = useMemo(() => SUBJECT_OPTIONS.map(s => ({ value: s, label: s })), []);
    const teacherOptions = useMemo(() => teachers.map(t => ({ value: t.id, label: t.name })), [teachers]);
    
    const canSave = bulkMode 
        ? (selectedLevel && selectedArms.size > 0 && localAs.subject_name && localAs.teacher_user_id && localAs.term_id)
        : (localAs.academic_class_id && localAs.subject_name && localAs.teacher_user_id);

    return (
        <div className="p-6 border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800 rounded-xl space-y-4 animate-fade-in">
             <h4 className="font-bold text-slate-800 dark:text-white">{localAs.id ? 'Edit' : 'Create'} Assignment</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Term</label>
                     <select name="term_id" value={localAs.term_id || ''} onChange={handleChange} className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">Select Term</option>
                        {terms.map(t => <option key={t.id} value={t.id}>{t.session_label} {t.term_label}</option>)}
                     </select>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Academic Class</label>
                    <div className="space-y-2">
                        <select 
                            value={selectedLevel} 
                            onChange={e => setSelectedLevel(e.target.value)} 
                            className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100" 
                            disabled={!localAs.term_id}
                        >
                            <option value="">Select Level</option>
                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                        
                        {/* Bulk mode toggle - only show when creating new */}
                        {!localAs.id && localAs.term_id && selectedLevel && (
                            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={bulkMode} 
                                    onChange={e => {
                                        setBulkMode(e.target.checked);
                                        if (!e.target.checked && selectedArms.size > 0) {
                                            // Keep only first arm when switching back to single mode
                                            setSelectedArms(new Set([Array.from(selectedArms)[0]]));
                                        }
                                    }}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                />
                                Assign to multiple arms at once
                            </label>
                        )}
                        
                        {/* Multi-select arms when in bulk mode */}
                        {bulkMode ? (
                            <div className="border rounded-lg p-3 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 max-h-40 overflow-y-auto">
                                <p className="text-xs text-slate-500 mb-2">Select arms (optional - leave empty for all):</p>
                                <div className="space-y-1">
                                    {arms.length > 0 ? arms.map(a => (
                                        <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 p-1 rounded">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedArms.has(a.name)} 
                                                onChange={e => {
                                                    const newSet = new Set(selectedArms);
                                                    if (e.target.checked) {
                                                        newSet.add(a.name);
                                                    } else {
                                                        newSet.delete(a.name);
                                                    }
                                                    setSelectedArms(newSet);
                                                }}
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                            />
                                            {a.name}
                                        </label>
                                    )) : (
                                        <p className="text-xs text-slate-400">No arms defined</p>
                                    )}
                                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 p-1 rounded">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedArms.has('')} 
                                            onChange={e => {
                                                const newSet = new Set(selectedArms);
                                                if (e.target.checked) {
                                                    newSet.add('');
                                                } else {
                                                    newSet.delete('');
                                                }
                                                setSelectedArms(newSet);
                                            }}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                        />
                                        <span className="italic">No arm (default)</span>
                                    </label>
                                </div>
                            </div>
                        ) : (
                            /* Single arm select when not in bulk mode */
                            <select 
                                value={Array.from(selectedArms)[0] || ''} 
                                onChange={e => setSelectedArms(new Set([e.target.value]))} 
                                className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100" 
                                disabled={!localAs.term_id || !selectedLevel}
                            >
                                <option value="">Select Arm (Optional)</option>
                                {arms.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                            </select>
                        )}
                    </div>
                    {!localAs.term_id && <p className="text-xs text-amber-600 mt-1">Select a term first.</p>}
                    {!bulkMode && localAs.term_id && selectedLevel && !localAs.academic_class_id && (
                        <p className="text-xs text-red-600 mt-1">
                            This class/arm combination does not exist for the selected session. Please create it in 'Academic Classes' first.
                        </p>
                    )}
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                    <SearchableSelect 
                        options={subjectOptions} 
                        value={localAs.subject_name || null} 
                        onChange={handleSubjectSelect} 
                        placeholder="Search Subject..."
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teacher</label>
                    <SearchableSelect 
                        options={teacherOptions} 
                        value={localAs.teacher_user_id || null} 
                        onChange={handleTeacherSelect} 
                        placeholder="Search Teacher..."
                    />
                 </div>
             </div>
             
             <div className="flex justify-end gap-3 pt-4 border-t border-blue-200 dark:border-blue-800">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700">
                    Cancel
                </button>
                <button onClick={handleSave} disabled={isSaving || !canSave} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2">
                    {isSaving ? <Spinner size="sm"/> : bulkMode ? `Save ${selectedArms.size || 'All'} Assignment(s)` : 'Save Assignment'}
                </button>
            </div>
         </div>
    );
};

export default AcademicAssignmentManager;
