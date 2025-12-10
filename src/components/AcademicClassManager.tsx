
import React, { useState, useMemo, useEffect } from 'react';
import type { AcademicClass, Term, AssessmentStructure, BaseDataObject, Student, AcademicClassStudent, GradingScheme, ReportCardConfig, SchoolConfig, AssessmentComponent } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, TrashIcon, UsersIcon, CloseIcon, SearchIcon, CheckCircleIcon, EditIcon, ShieldIcon } from './common/icons';

const ResultSheetPreview: React.FC<{ structure: AssessmentStructure | null; config: ReportCardConfig | undefined; schoolConfig: SchoolConfig | null }> = ({ structure, config, schoolConfig }) => {
    const themeColor = config?.colorTheme || '#1E3A8A';
    const showPhoto = config?.showPhoto !== false;
    const orientation = config?.orientation || 'portrait';
    const layout = config?.layout || 'classic';
    const showGraph = config?.showGraph || false;
    
    // Overrides
    const displayName = config?.schoolNameOverride || schoolConfig?.display_name || 'SCHOOL NAME';
    const principalLabel = config?.principalLabel || 'Principal';
    const teacherLabel = config?.teacherLabel || 'Class Teacher';

    if (!structure) return <div className="text-xs text-slate-500 text-center p-4 bg-slate-50 dark:bg-slate-800 rounded border border-dashed border-slate-300 dark:border-slate-700">Select an Assessment Structure to preview the result sheet.</div>;
    
    // Adjust aspect ratio for preview based on orientation
    const aspectRatio = orientation === 'landscape' ? 'aspect-[1.414/1]' : 'aspect-[1/1.414]';
    const components = structure.components || [];

    // Advanced layouts rendering
    if (layout === 'modern-gradient') {
        return (
            <div className={`shadow-xl text-[10px] w-full mx-auto rounded-lg overflow-hidden flex flex-col ${aspectRatio}`} style={{ maxWidth: orientation === 'landscape' ? '600px' : '400px' }}>
                {/* Gradient Header */}
                <div className="p-3" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}CC)` }}>
                    <div className="flex gap-3 items-center text-white">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <ShieldIcon className="w-6 h-6 text-white"/>
                        </div>
                        <div>
                            <h1 className="font-bold text-xs uppercase">{displayName}</h1>
                            <p className="text-[9px] opacity-80">Term Report Card</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white flex-grow p-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                            <p className="text-[8px] text-blue-600">Student</p>
                            <p className="font-bold text-blue-900">John Doe</p>
                        </div>
                        <div className="p-2 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                            <p className="text-[8px] text-green-600">Average</p>
                            <p className="font-bold text-green-900">85.4%</p>
                        </div>
                    </div>
                    {['Math', 'English', 'Science'].map((subj, idx) => (
                        <div key={idx} className="p-2 rounded-lg border border-slate-200 flex justify-between items-center">
                            <span className="font-medium">{subj}</span>
                            <span className="font-bold px-2 py-0.5 rounded" style={{ backgroundColor: themeColor + '20', color: themeColor }}>A</span>
                        </div>
                    ))}
                </div>
                <div className="bg-slate-800 text-white text-center py-1 text-[8px]">Modern Gradient Layout</div>
            </div>
        );
    }
    
    if (layout === 'banded-rows') {
        return (
            <div className={`border-2 border-slate-300 bg-white shadow-xl text-[10px] w-full mx-auto overflow-hidden flex flex-col ${aspectRatio}`} style={{ maxWidth: orientation === 'landscape' ? '600px' : '400px' }}>
                <div className="p-3 border-b-2 border-slate-300 bg-slate-100">
                    <h1 className="font-bold text-xs text-center uppercase">{displayName}</h1>
                    <p className="text-center text-[9px] text-slate-600">STUDENT RESULT SHEET</p>
                </div>
                <div className="flex-grow p-2">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-700 text-white">
                                <th className="border border-slate-400 p-1 text-left">Subject</th>
                                <th className="border border-slate-400 p-1 text-center w-16">Score</th>
                                <th className="border border-slate-400 p-1 text-center w-12">Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            {['Mathematics', 'English', 'Science', 'Social Studies'].map((subj, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                                    <td className="border border-slate-300 p-1">{subj}</td>
                                    <td className="border border-slate-300 p-1 text-center font-bold">85</td>
                                    <td className="border border-slate-300 p-1 text-center font-bold text-green-600">A</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-800 text-white text-center py-1 text-[8px]">Banded Rows Layout</div>
            </div>
        );
    }
    
    if (layout === 'executive-dark') {
        return (
            <div className={`bg-slate-900 text-white shadow-xl text-[10px] w-full mx-auto rounded-lg overflow-hidden flex flex-col ${aspectRatio}`} style={{ maxWidth: orientation === 'landscape' ? '600px' : '400px' }}>
                <div className="p-3 border-b border-slate-700">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="font-bold text-xs text-amber-400 uppercase">{displayName}</h1>
                            <p className="text-[9px] text-slate-400">Academic Performance Report</p>
                        </div>
                        <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                            <ShieldIcon className="w-6 h-6 text-amber-400"/>
                        </div>
                    </div>
                </div>
                <div className="flex-grow p-3 space-y-2">
                    <div className="p-2 bg-slate-800 rounded">
                        <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                            <span>Student: John Doe</span>
                            <span>Class: JSS 1</span>
                        </div>
                    </div>
                    {['Math', 'English', 'Science'].map((subj, idx) => (
                        <div key={idx} className="bg-slate-800 p-2 rounded">
                            <div className="flex justify-between text-[9px] mb-1">
                                <span>{subj}</span>
                                <span className="text-amber-400">85%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-400" style={{ width: '85%' }}></div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="bg-amber-500 text-slate-900 text-center py-1 text-[8px] font-bold">Executive Dark Layout</div>
            </div>
        );
    }
    
    if (layout === 'minimalist-clean') {
        return (
            <div className={`bg-white shadow-xl text-[10px] w-full mx-auto overflow-hidden flex flex-col ${aspectRatio}`} style={{ maxWidth: orientation === 'landscape' ? '600px' : '400px', border: '1px solid #e5e5e5' }}>
                <div className="p-4 border-b">
                    <h1 className="text-lg font-light text-slate-800 tracking-wide">{displayName}</h1>
                    <div className="w-8 h-0.5 bg-slate-300 mt-2"></div>
                </div>
                <div className="flex-grow p-4">
                    <div className="mb-4">
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">Student</p>
                        <p className="text-sm font-light text-slate-800">John Doe</p>
                    </div>
                    <div className="space-y-3">
                        {['Mathematics', 'English Language', 'Basic Science'].map((subj, idx) => (
                            <div key={idx} className="flex justify-between items-baseline border-b border-dotted border-slate-200 pb-1">
                                <span className="font-light text-slate-700">{subj}</span>
                                <span className="text-xs font-medium" style={{ color: themeColor }}>A</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-3 text-center border-t">
                    <p className="text-[8px] text-slate-400">Minimalist Clean Layout</p>
                </div>
            </div>
        );
    }

    // Standard layouts (classic, modern, compact, professional, pastel)
    return (
        <div className={`border bg-white shadow-xl text-[10px] w-full mx-auto rounded-sm overflow-hidden flex flex-col ${aspectRatio}`} style={{ borderTop: `4px solid ${themeColor}`, maxWidth: orientation === 'landscape' ? '600px' : '400px' }}>
            {/* Header */}
            <div className="p-3 flex gap-3 items-center border-b border-slate-200" style={{ backgroundColor: layout === 'modern' ? themeColor + '10' : layout === 'pastel' ? themeColor + '20' : 'transparent' }}>
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center shrink-0 border border-slate-200">
                    {config?.customLogoUrl || schoolConfig?.logo_url ? (
                        <img src={config?.customLogoUrl || schoolConfig?.logo_url} className="w-8 h-8 object-contain"/> 
                    ) : (
                        <ShieldIcon className="w-6 h-6 text-slate-400"/>
                    )}
                </div>
                <div className="flex-grow">
                    <h1 className="font-bold text-xs text-slate-800 uppercase leading-tight">{displayName}</h1>
                    <p className="text-slate-500 text-[9px] leading-tight">{schoolConfig?.address || 'School Address'}</p>
                    <p className="text-slate-400 text-[9px] uppercase mt-0.5 font-semibold" style={{ color: themeColor }}>Term Report Card ({layout})</p>
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
            <div className="p-2 flex-grow">
                <table className={`w-full border-collapse ${layout === 'professional' ? 'border-2 border-black' : 'border border-slate-300'}`}>
                    <thead className={layout === 'modern' ? '' : layout === 'pastel' ? 'bg-slate-100' : 'bg-slate-100 text-slate-700'} style={layout === 'modern' ? { backgroundColor: themeColor, color: 'white' } : layout === 'pastel' ? { backgroundColor: themeColor + '30' } : {}}>
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
                            <th className="border border-slate-300 p-1 text-center w-8 font-bold">Grade</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['Math', 'English', 'Science'].map((subj, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? (layout === 'pastel' ? 'bg-purple-50' : 'bg-white') : (layout === 'pastel' ? 'bg-blue-50' : 'bg-slate-50')}>
                                <td className="border border-slate-300 p-1 font-medium text-slate-800">{subj}</td>
                                {(components || []).map((c, i) => (
                                    <td key={i} className="border border-slate-300 p-1 text-center text-slate-500">-</td>
                                ))}
                                <td className="border border-slate-300 p-1 text-center font-bold">-</td>
                                <td className="border border-slate-300 p-1 text-center font-bold">-</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {showGraph && (
                    <div className="mt-2 p-2 border border-dashed border-slate-300 rounded text-center text-[8px] text-slate-400 bg-slate-50">
                        [Performance Graph Placeholder]
                    </div>
                )}
            </div>

            {/* Signatories Preview */}
            <div className="px-2 pb-2 grid grid-cols-2 gap-2 mt-auto">
                <div className="border border-slate-300 p-1.5 rounded">
                    <p className="font-bold text-slate-700 text-[9px] border-b border-slate-200 mb-1 pb-0.5">{teacherLabel}</p>
                    <p className="italic text-slate-500 h-3 text-[9px]">...</p>
                </div>
                <div className="border border-slate-300 p-1.5 rounded">
                    <p className="font-bold text-slate-700 text-[9px] border-b border-slate-200 mb-1 pb-0.5">{principalLabel}</p>
                    <p className="italic text-slate-500 h-3 text-[9px]">...</p>
                </div>
            </div>
            
            {/* Footer */}
            <div className="bg-slate-800 text-white text-center py-1 text-[8px]">
                Powered by School Guardian 360
            </div>
        </div>
    )
}

// ... (EnrollmentModal remains unchanged) ...
const EnrollmentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    academicClass: AcademicClass;
    termId: number;
    students: Student[];
    currentEnrollments: AcademicClassStudent[];
    onSave: (studentIds: number[]) => Promise<void>;
}> = ({ isOpen, onClose, academicClass, termId, students, currentEnrollments, onSave }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [enrolledIds, setEnrolledIds] = useState<Set<number>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const currentIds = currentEnrollments
                .filter(e => e.academic_class_id === academicClass.id && e.enrolled_term_id === termId)
                .map(e => e.student_id);
            setEnrolledIds(new Set(currentIds));
        }
    }, [isOpen, academicClass, termId, currentEnrollments]);

    const filteredStudents = useMemo(() => {
        // First filter by class level and arm to match the academic class
        let filtered = students.filter(s => {
            const studentClassName = s.class?.name;
            const studentArmName = s.arm?.name;
            return studentClassName === academicClass.level && studentArmName === academicClass.arm;
        });
        
        // Then apply search filter if provided
        if (searchQuery.trim()) {
            filtered = filtered.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        
        return filtered;
    }, [students, searchQuery, academicClass.level, academicClass.arm]);

    const toggleStudent = (id: number) => {
        const newSet = new Set(enrolledIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setEnrolledIds(newSet);
    };

    const isAllSelected = filteredStudents.length > 0 && filteredStudents.every(s => enrolledIds.has(s.id));

    const handleSelectAll = () => {
        const newSet = new Set(enrolledIds);
        if (isAllSelected) {
            // Deselect all visible
            filteredStudents.forEach(s => newSet.delete(s.id));
        } else {
            // Select all visible
            filteredStudents.forEach(s => newSet.add(s.id));
        }
        setEnrolledIds(newSet);
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(Array.from(enrolledIds));
        setIsSaving(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Manage Enrollment: {academicClass.name}</h2>
                    <button onClick={onClose}><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            placeholder="Search students..." 
                            className="w-full pl-9 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        />
                    </div>
                    <div className="flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300 select-none">
                            <input 
                                type="checkbox" 
                                checked={isAllSelected} 
                                onChange={handleSelectAll}
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                            />
                            Select All Visible ({filteredStudents.length})
                        </label>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-4 space-y-1">
                    {filteredStudents.map(s => (
                        <div key={s.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${enrolledIds.has(s.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`} onClick={() => toggleStudent(s.id)}>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    checked={enrolledIds.has(s.id)} 
                                    readOnly 
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 pointer-events-none" 
                                />
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-white">{s.name}</p>
                                    <p className="text-xs text-slate-500">{s.admission_number || 'No ID'}</p>
                                </div>
                            </div>
                            {enrolledIds.has(s.id) && <CheckCircleIcon className="w-5 h-5 text-blue-600" />}
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg dark:text-white">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
                        {isSaving ? <Spinner size="sm"/> : `Save (${enrolledIds.size})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface AcademicClassManagerProps {
    academicClasses: AcademicClass[];
    terms: Term[];
    onSave: (ac: Partial<AcademicClass>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
    classes: BaseDataObject[];
    arms: BaseDataObject[];
    assessmentStructures: AssessmentStructure[];
    students: Student[];
    academicClassStudents: AcademicClassStudent[];
    onUpdateEnrollment: (classId: number, termId: number, studentIds: number[]) => Promise<boolean>;
    gradingSchemes: GradingScheme[];
    schoolConfig: SchoolConfig | null;
}

const AcademicClassManager: React.FC<AcademicClassManagerProps> = ({ 
    academicClasses = [], 
    terms = [], 
    onSave, 
    onDelete, 
    classes = [], 
    arms = [], 
    assessmentStructures = [], 
    students = [], 
    academicClassStudents = [], 
    onUpdateEnrollment, 
    gradingSchemes = [], 
    schoolConfig 
}) => {
    const [editingClass, setEditingClass] = useState<Partial<AcademicClass> | null>(null);
    const [enrollmentClass, setEnrollmentClass] = useState<AcademicClass | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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

    // Default to active term if nothing selected/saved
    useEffect(() => {
        if (selectedTermId === '' && terms.length > 0) {
            const active = terms.find(t => t.is_active);
            if (active) setSelectedTermId(active.id);
            else setSelectedTermId(terms[0].id);
        }
    }, [terms, selectedTermId]);

    const handleSave = async (ac: Partial<AcademicClass>) => {
        setIsSaving(true);
        const success = await onSave(ac);
        if (success) {
            setEditingClass(null);
        }
        setIsSaving(false);
    };

    const filteredClasses = useMemo(() => {
        if (!selectedTermId) return [];
        const term = terms.find(t => t.id === selectedTermId);
        if (!term) return [];
        return academicClasses.filter(ac => ac.session_label === term.session_label);
    }, [selectedTermId, academicClasses, terms]);

    const handleEnrollmentSave = async (studentIds: number[]) => {
        if (enrollmentClass && selectedTermId) {
            await onUpdateEnrollment(enrollmentClass.id, Number(selectedTermId), studentIds);
        }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Manage Academic Classes</h3>
                {!editingClass && (
                    <button onClick={() => setEditingClass({ report_config: { layout: 'classic', showPhoto: true, showPosition: true, showGraph: false, orientation: 'portrait' } as ReportCardConfig })} className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100">
                        <PlusCircleIcon className="w-5 h-5"/> New Class
                    </button>
                )}
            </div>

            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <label className="text-sm font-medium mr-2">Select Term:</label>
                <select value={selectedTermId} onChange={e => setSelectedTermId(Number(e.target.value))} className="p-2 rounded border bg-white dark:bg-slate-700 dark:border-slate-600">
                    <option value="">-- Select Term --</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.session_label} - {t.term_label}</option>)}
                </select>
            </div>

            {editingClass ? (
                <AcademicClassForm 
                    academicClass={editingClass} 
                    onSave={handleSave} 
                    onCancel={() => setEditingClass(null)} 
                    isSaving={isSaving}
                    terms={terms}
                    classes={classes}
                    arms={arms}
                    assessmentStructures={assessmentStructures}
                    gradingSchemes={gradingSchemes}
                    schoolConfig={schoolConfig}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClasses.length > 0 ? filteredClasses.map(ac => {
                        const studentCount = selectedTermId 
                            ? academicClassStudents.filter(s => s.academic_class_id === ac.id && s.enrolled_term_id === Number(selectedTermId)).length
                            : 0;

                        return (
                            <div key={ac.id} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">{ac.name}</h4>
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditingClass(ac)} className="text-slate-400 hover:text-blue-600"><EditIcon className="w-4 h-4"/></button>
                                        <button onClick={() => onDelete(ac.id)} className="text-slate-400 hover:text-red-600"><TrashIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-slate-500">{ac.session_label}</p>
                                    <span className="text-xs text-slate-300 dark:text-slate-600">•</span>
                                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{studentCount} Students</p>
                                </div>
                                <div className="mt-2">
                                    <p className="text-xs text-slate-500">Layout: {ac.report_config?.layout || 'classic'} ({ac.report_config?.orientation || 'portrait'})</p>
                                    {(ac.min_subjects !== null || ac.max_subjects !== null) && (
                                        <p className="text-xs text-slate-500 mt-1">Subjects: {ac.min_subjects || 0} - {ac.max_subjects || 'Unl.'}</p>
                                    )}
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400">
                                        {ac.assessment_structure?.name || 'Default Structure'}
                                    </span>
                                    <button 
                                        onClick={() => setEnrollmentClass(ac)} 
                                        className="text-xs flex items-center gap-1 text-blue-600 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded"
                                    >
                                        <UsersIcon className="w-3 h-3"/> Enrollment
                                    </button>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="col-span-full text-center py-8 text-slate-500">No classes found for this session.</div>
                    )}
                </div>
            )}

            {enrollmentClass && selectedTermId && (
                <EnrollmentModal 
                    isOpen={!!enrollmentClass} 
                    onClose={() => setEnrollmentClass(null)} 
                    academicClass={enrollmentClass}
                    termId={Number(selectedTermId)}
                    students={students}
                    currentEnrollments={academicClassStudents}
                    onSave={handleEnrollmentSave}
                />
            )}
        </div>
    );
};

type FormTab = 'general' | 'design' | 'signatories' | 'subjects';

const AcademicClassForm: React.FC<{
    academicClass: Partial<AcademicClass>;
    onSave: (ac: Partial<AcademicClass>) => void;
    onCancel: () => void;
    isSaving: boolean;
    terms: Term[];
    classes: BaseDataObject[];
    arms: BaseDataObject[];
    assessmentStructures: AssessmentStructure[];
    gradingSchemes: GradingScheme[];
    schoolConfig: SchoolConfig | null;
}> = ({ academicClass, onSave, onCancel, isSaving, terms = [], classes = [], arms = [], assessmentStructures = [], gradingSchemes = [], schoolConfig }) => {
    const [localAc, setLocalAc] = useState(academicClass);
    const [activeTab, setActiveTab] = useState<FormTab>('general');

    // Extract unique session labels from terms - SAFE ACCESS
    const sessions = useMemo(() => Array.from(new Set((terms || []).map(t => t.session_label))), [terms]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setLocalAc(prev => ({ ...prev, [name]: value }));
    };
    
    // Auto-generate name
    useEffect(() => {
        if (localAc.level && localAc.session_label) {
            const name = `${localAc.level}${localAc.arm ? ` ${localAc.arm}` : ''} (${localAc.session_label})`;
            setLocalAc(prev => ({ ...prev, name }));
        }
    }, [localAc.level, localAc.arm, localAc.session_label]);
    
    const handleConfigChange = (field: keyof ReportCardConfig, value: any) => {
        setLocalAc(prev => ({
            ...prev,
            report_config: {
                ...prev.report_config || { layout: 'classic', showPhoto: true, showPosition: true, showGraph: false, orientation: 'portrait' },
                [field]: value
            }
        }));
    };
    
    // Find the selected assessment structure to show a preview
    const selectedStructure = useMemo(() => {
        return (assessmentStructures || []).find(s => s.id === localAc.assessment_structure_id);
    }, [localAc.assessment_structure_id, assessmentStructures]);

    const inputClass = "w-full p-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600";

    const renderTabContent = () => {
        switch(activeTab) {
            case 'general':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Session</label>
                            <select name="session_label" value={localAc.session_label || ''} onChange={handleChange} className={inputClass}>
                                <option value="">Select Session</option>
                                {sessions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Level (Class)</label>
                            <select name="level" value={localAc.level || ''} onChange={handleChange} className={inputClass}>
                                <option value="">Select Level</option>
                                {(classes || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Arm</label>
                            <select name="arm" value={localAc.arm || ''} onChange={handleChange} className={inputClass}>
                                <option value="">Select Arm</option>
                                {(arms || []).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                            </select>
                            {!localAc.arm && (
                                <p className="text-xs text-red-600 mt-1">Arm is required</p>
                            )}
                        </div>
                        
                        <div>
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Report Card Structure (Result Template)</label>
                             <select name="assessment_structure_id" value={localAc.assessment_structure_id || ''} onChange={e => setLocalAc(prev => ({ ...prev, assessment_structure_id: Number(e.target.value) || null }))} className={inputClass}>
                                <option value="">Select Structure</option>
                                {(assessmentStructures || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                             </select>
                        </div>

                        <div className="sm:col-span-2">
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Grading Scheme</label>
                             <select name="grading_scheme_id" value={localAc.grading_scheme_id || ''} onChange={e => setLocalAc(prev => ({ ...prev, grading_scheme_id: Number(e.target.value) || null }))} className={inputClass}>
                                <option value="">Use School Default</option>
                                {(gradingSchemes || []).map(s => <option key={s.id} value={s.id}>{s.scheme_name}</option>)}
                             </select>
                        </div>
                    </div>
                );
            case 'design':
                return (
                    <div className="space-y-6">
                    <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Report Layout Template</label>
                            <select value={localAc.report_config?.layout || 'classic'} onChange={e => handleConfigChange('layout', e.target.value)} className={inputClass}>
                                <optgroup label="Standard Layouts">
                                    <option value="classic">Classic (Standard Table)</option>
                                    <option value="modern">Modern (Colored Headers)</option>
                                    <option value="compact">Compact (Dense Data)</option>
                                    <option value="professional">Professional (Minimalist)</option>
                                    <option value="pastel">Pastel (Colorful)</option>
                                </optgroup>
                                <optgroup label="Advanced Layouts">
                                    <option value="modern-gradient">Modern Gradient (Card-based with gradient headers)</option>
                                    <option value="banded-rows">Banded Rows (Table with alternating row colors)</option>
                                    <option value="executive-dark">Executive Dark (Dark mode with progress bars)</option>
                                    <option value="minimalist-clean">Minimalist Clean (Typography-focused)</option>
                                </optgroup>
                            </select>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Orientation</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => handleConfigChange('orientation', 'portrait')} className={`flex-1 py-2 px-3 rounded-lg border text-sm ${localAc.report_config?.orientation === 'portrait' || !localAc.report_config?.orientation ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-300 text-slate-600'}`}>Portrait</button>
                                    <button type="button" onClick={() => handleConfigChange('orientation', 'landscape')} className={`flex-1 py-2 px-3 rounded-lg border text-sm ${localAc.report_config?.orientation === 'landscape' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-300 text-slate-600'}`}>Landscape</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Theme Color</label>
                                <input type="color" value={localAc.report_config?.colorTheme || '#1E3A8A'} onChange={e => handleConfigChange('colorTheme', e.target.value)} className="w-full p-1 h-10 border rounded-lg" />
                            </div>
                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Custom Logo URL</label>
                                <input type="text" value={localAc.report_config?.customLogoUrl || ''} onChange={e => handleConfigChange('customLogoUrl', e.target.value)} placeholder="Leave empty for school default" className={inputClass} />
                            </div>
                             <div className="md:col-span-2 flex gap-6 flex-wrap">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={localAc.report_config?.showPhoto !== false} onChange={e => handleConfigChange('showPhoto', e.target.checked)} className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm">Show Student Photo</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={localAc.report_config?.showPosition !== false} onChange={e => handleConfigChange('showPosition', e.target.checked)} className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm">Show Position in Class</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={localAc.report_config?.showGraph || false} onChange={e => handleConfigChange('showGraph', e.target.checked)} className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm">Show Performance Graph</span>
                                </label>
                            </div>
                        </div>
                    </div>
                );
            case 'signatories':
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">Customize the titles and names that appear on the report card signature blocks.</p>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">School Name Override (Optional)</label>
                            <input type="text" value={localAc.report_config?.schoolNameOverride || ''} onChange={e => handleConfigChange('schoolNameOverride', e.target.value)} placeholder={schoolConfig?.display_name || 'e.g., UPSS Junior School'} className={inputClass} />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Principal Label</label>
                                <input type="text" value={localAc.report_config?.principalLabel || ''} onChange={e => handleConfigChange('principalLabel', e.target.value)} placeholder="Principal" className={inputClass} />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Principal Name Override</label>
                                <input type="text" value={localAc.report_config?.principalNameOverride || ''} onChange={e => handleConfigChange('principalNameOverride', e.target.value)} placeholder="Dr. A. Smith" className={inputClass} />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teacher Label</label>
                                <input type="text" value={localAc.report_config?.teacherLabel || ''} onChange={e => handleConfigChange('teacherLabel', e.target.value)} placeholder="Class Teacher" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teacher Name Override</label>
                                <input type="text" value={localAc.report_config?.teacherNameOverride || ''} onChange={e => handleConfigChange('teacherNameOverride', e.target.value)} placeholder="Mr. B. Jones" className={inputClass} />
                            </div>
                         </div>
                    </div>
                );
            case 'subjects':
                return (
                    <div className="space-y-4">
                         <h5 className="font-semibold text-slate-700 dark:text-slate-200">Subject Selection Constraints</h5>
                         <p className="text-sm text-slate-500">Set limits on how many subjects students in this class can or must choose.</p>
                         <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Minimum Subjects</label>
                                <input 
                                    type="number" 
                                    name="min_subjects" 
                                    value={localAc.min_subjects || ''} 
                                    onChange={e => setLocalAc(prev => ({ ...prev, min_subjects: e.target.value ? Number(e.target.value) : null }))} 
                                    placeholder="e.g. 8" 
                                    className={inputClass} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Maximum Subjects</label>
                                <input 
                                    type="number" 
                                    name="max_subjects" 
                                    value={localAc.max_subjects || ''} 
                                    onChange={e => setLocalAc(prev => ({ ...prev, max_subjects: e.target.value ? Number(e.target.value) : null }))} 
                                    placeholder="e.g. 12" 
                                    className={inputClass} 
                                />
                            </div>
                         </div>
                         <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
                             These limits will be enforced in the Student Portal when students select their subjects.
                         </div>
                    </div>
                )
        }
    };

    return (
        <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-6 animate-fade-in flex flex-col lg:flex-row gap-8">
            
            {/* Left: Form with Tabs */}
            <div className="lg:w-1/2 flex flex-col h-full">
                 <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-4">{localAc.id ? 'Edit' : 'Create'} Academic Class</h4>
                 
                 <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-700 mb-4 overflow-x-auto">
                     {['general', 'design', 'signatories', 'subjects'].map((tab) => (
                         <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as FormTab)}
                            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            {tab}
                        </button>
                     ))}
                 </div>

                 <div className="flex-grow">
                    {renderTabContent()}
                 </div>

                 <div className="mt-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Class Name (Auto-generated)</label>
                    <input name="name" value={localAc.name || ''} readOnly className="w-full p-2 border rounded-lg bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed"/>
                </div>

                <div className="flex justify-end gap-3 pt-4 mt-auto border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700">Cancel</button>
                    <button onClick={() => onSave(localAc)} disabled={isSaving || !localAc.session_label || !localAc.level || !localAc.arm} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2">
                        {isSaving ? <Spinner size="sm"/> : 'Save Class'}
                    </button>
                </div>
            </div>

            {/* Right: Live Preview */}
            <div className="lg:w-1/2 border-l pl-6 border-slate-200 dark:border-slate-700 hidden lg:flex flex-col">
                 <h5 className="font-semibold text-sm text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <ShieldIcon className="w-4 h-4"/> Live Result Sheet Preview
                </h5>
                <div className="flex-grow flex items-center justify-center bg-slate-200/50 dark:bg-black/20 p-4 rounded-lg overflow-auto">
                     <ResultSheetPreview 
                        structure={selectedStructure || null} 
                        config={localAc.report_config}
                        schoolConfig={schoolConfig}
                     />
                </div>
                <p className="text-xs text-center mt-2 text-slate-500">This preview approximates the print layout.</p>
            </div>
        </div>
    );
};

export default AcademicClassManager;
