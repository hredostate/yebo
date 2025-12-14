
import React, { useState, useEffect } from 'react';
import type { QuizWithQuestions, QuizQuestion, AudienceRule, RoleDetails, BaseDataObject, RoleTitle, MultipleChoiceOption } from '../types';
import { QuizQuestionType } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, TrashIcon } from './common/icons';
import QuizResultsView from './QuizResultsView';

interface QuizManagerProps {
    quizzes: QuizWithQuestions[];
    onSaveQuiz: (quizData: Omit<QuizWithQuestions, 'id' | 'created_at' | 'school_id' | 'created_by'> & { id?: number }) => Promise<void>;
    onDeleteQuiz: (quizId: number) => Promise<void>;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    allClasses: BaseDataObject[];
    allArms: BaseDataObject[];
    allRoles: RoleDetails[];
    scoreEntries?: any[];
    attendanceRecords?: any[];
    reports?: any[];
}

const AddAudienceRule: React.FC<{
    onAdd: (rule: AudienceRule) => void;
    allClasses: BaseDataObject[];
    allArms: BaseDataObject[];
    allRoles: RoleDetails[];
}> = ({ onAdd, allClasses, allArms, allRoles }) => {
    const [type, setType] = useState('global');
    const [globalValue, setGlobalValue] = useState('all_staff');
    const [roleValue, setRoleValue] = useState<RoleTitle>('Teacher');
    const [classValue, setClassValue] = useState<number | ''>('');
    const [armValue, setArmValue] = useState<number | ''>('');

    const handleAdd = () => {
        let rule: AudienceRule | null = null;
        switch (type) {
            case 'global':
                rule = { type: 'global', value: globalValue as 'all_staff' | 'all_students' | 'everyone', name: `Global: ${globalValue.replace('_', ' ')}` };
                break;
            case 'role':
                rule = { type: 'role', value: roleValue, name: `Role: ${roleValue}` };
                break;
            case 'class':
                if (classValue) {
                    const className = allClasses.find(c => c.id === classValue)?.name || '';
                    rule = { type: 'class', class_id: classValue, name: `Class: ${className}` };
                }
                break;
            case 'class_arm':
                if (classValue && armValue) {
                    const className = allClasses.find(c => c.id === classValue)?.name || '';
                    const armName = allArms.find(a => a.id === armValue)?.name || '';
                    rule = { type: 'class_arm', class_id: classValue, arm_id: armValue, name: `${className} (${armName})` };
                }
                break;
        }
        if (rule) {
            onAdd(rule);
        }
    };

    return (
        <div className="flex items-end gap-2 p-2 border rounded-lg bg-slate-500/5 flex-wrap">
            <select value={type} onChange={e => setType(e.target.value)} className="p-2 border rounded-md">
                <option value="global">Global</option>
                <option value="role">Role</option>
                <option value="class">Class</option>
                <option value="class_arm">Class & Arm</option>
            </select>
            {type === 'global' && <select value={globalValue} onChange={e => setGlobalValue(e.target.value)} className="p-2 border rounded-md"><option value="all_staff">All Staff</option><option value="all_students">All Students</option><option value="everyone">Everyone</option></select>}
            {type === 'role' && <select value={roleValue} onChange={e => setRoleValue(e.target.value as RoleTitle)} className="p-2 border rounded-md">{allRoles.map(r => <option key={r.id} value={r.title}>{r.title}</option>)}</select>}
            {(type === 'class' || type === 'class_arm') && <select value={classValue} onChange={e => setClassValue(Number(e.target.value))} className="p-2 border rounded-md"><option value="">Select Class</option>{allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
            {type === 'class_arm' && <select value={armValue} onChange={e => setArmValue(Number(e.target.value))} className="p-2 border rounded-md"><option value="">Select Arm</option>{allArms.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
            <button type="button" onClick={handleAdd} className="px-3 py-2 bg-blue-500 text-white rounded-md">Add</button>
        </div>
    )
}

const QuizBuilderModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (quizData: Omit<QuizWithQuestions, 'id' | 'created_at' | 'school_id' | 'created_by'> & { id?: number }) => Promise<void>;
    existingQuiz: QuizWithQuestions | null;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    allClasses: BaseDataObject[];
    allArms: BaseDataObject[];
    allRoles: RoleDetails[];
}> = ({ isOpen, onClose, onSave, existingQuiz, addToast, allClasses, allArms, allRoles }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [audience, setAudience] = useState<AudienceRule[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitle(existingQuiz?.title || '');
            setDescription(existingQuiz?.description || '');
            setAudience(existingQuiz?.audience || []);
            if (existingQuiz && existingQuiz.questions) {
                // Deep copy and sort to avoid mutation issues and ensure order
                const sortedQuestions = [...existingQuiz.questions].sort((a, b) => a.position - b.position);
                setQuestions(sortedQuestions);
            } else {
                setQuestions([]);
            }
        }
    }, [isOpen, existingQuiz]);

    if (!isOpen) return null;

    const addQuestion = (type: QuizQuestionType) => {
        const newQuestion: QuizQuestion = {
            question_text: '',
            question_type: type,
            position: questions.length + 1,
            options: type === 'multiple_choice' ? [{ text: '', quota: null }] : undefined,
        };
        setQuestions([...questions, newQuestion]);
    };

    const updateQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value };
        setQuestions(newQuestions);
    };
    
    const updateOption = (qIndex: number, oIndex: number, text: string) => {
        const newQuestions = [...questions];
        const options = newQuestions[qIndex].options as MultipleChoiceOption[];
        if(options) {
            options[oIndex].text = text;
            setQuestions(newQuestions);
        }
    }
    
    const addOption = (qIndex: number) => {
        const newQuestions = [...questions];
        const options = newQuestions[qIndex].options as MultipleChoiceOption[];
        if(options) {
            options.push({ text: '', quota: null });
            setQuestions(newQuestions);
        }
    }
    
    const removeOption = (qIndex: number, oIndex: number) => {
        const newQuestions = [...questions];
        const options = newQuestions[qIndex].options as MultipleChoiceOption[];
        if(options) {
            options.splice(oIndex, 1);
            setQuestions(newQuestions);
        }
    }

    const removeQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!title.trim()) {
            addToast('Title is required', 'error');
            return;
        }
        if (questions.length === 0) {
            addToast('Add at least one question', 'error');
            return;
        }
        setIsSaving(true);
        await onSave({
            id: existingQuiz?.id,
            title,
            description,
            questions,
            audience
        });
        setIsSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-4xl m-4 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{existingQuiz ? 'Edit Quiz' : 'Create Quiz'}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">&times;</button>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div className="space-y-2">
                        <input type="text" placeholder="Quiz Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded-md" />
                        <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded-md" rows={2} />
                    </div>
                    
                    <div className="p-4 border rounded-lg bg-slate-500/5">
                        <h3 className="font-semibold mb-2">Target Audience</h3>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {audience.map((rule, i) => (
                                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1">
                                    {rule.name}
                                    <button onClick={() => setAudience(prev => prev.filter((_, idx) => idx !== i))} className="ml-1">&times;</button>
                                </span>
                            ))}
                        </div>
                        <AddAudienceRule onAdd={(rule) => setAudience(prev => [...prev, rule])} allClasses={allClasses} allArms={allArms} allRoles={allRoles} />
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold">Questions</h3>
                        
                        <div className="flex gap-2 flex-wrap bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="text-sm text-slate-500 self-center mr-2">Add Question:</span>
                            <button onClick={() => addQuestion('multiple_choice')} className="px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded text-sm hover:bg-blue-100 dark:hover:bg-blue-900">Multiple Choice</button>
                            <button onClick={() => addQuestion('short_answer')} className="px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded text-sm hover:bg-blue-100 dark:hover:bg-blue-900">Short Answer</button>
                            <button onClick={() => addQuestion('true_false')} className="px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded text-sm hover:bg-blue-100 dark:hover:bg-blue-900">True/False</button>
                            <button onClick={() => addQuestion('ranking')} className="px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded text-sm hover:bg-blue-100 dark:hover:bg-blue-900">Rating</button>
                        </div>

                        {questions.map((q, i) => (
                            <div key={i} className="p-4 border rounded-lg bg-white/50 dark:bg-slate-800/50 relative">
                                <button onClick={() => removeQuestion(i)} className="absolute top-2 right-2 text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4"/></button>
                                <div className="flex gap-2 mb-2">
                                    <span className="font-bold text-slate-500">Q{i+1}</span>
                                    <input type="text" value={q.question_text} onChange={e => updateQuestion(i, 'question_text', e.target.value)} placeholder="Question Text" className="flex-grow p-1 border-b bg-transparent outline-none font-medium"/>
                                </div>
                                
                                {q.question_type === 'multiple_choice' && (
                                    <div className="ml-6 space-y-2">
                                        {(q.options as MultipleChoiceOption[])?.map((opt, oIndex) => (
                                            <div key={oIndex} className="flex items-center gap-2">
                                                <input type="radio" disabled className="h-4 w-4"/>
                                                <input type="text" value={opt.text} onChange={e => updateOption(i, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1}`} className="flex-grow p-1 border rounded bg-white dark:bg-slate-700"/>
                                                <button onClick={() => removeOption(i, oIndex)} className="text-red-400 hover:text-red-600">&times;</button>
                                            </div>
                                        ))}
                                        <button onClick={() => addOption(i)} className="text-sm text-blue-600 hover:underline">+ Add Option</button>
                                    </div>
                                )}
                                {q.question_type === 'short_answer' && <div className="ml-6 p-2 bg-slate-100 dark:bg-slate-700 rounded text-slate-400 italic text-sm">Short answer text input</div>}
                                {q.question_type === 'true_false' && (
                                    <div className="ml-6 flex gap-4 text-sm">
                                        <label className="flex items-center gap-1"><input type="radio" disabled/> True</label>
                                        <label className="flex items-center gap-1"><input type="radio" disabled/> False</label>
                                    </div>
                                )}
                                {q.question_type === 'ranking' && <div className="ml-6 p-2 text-yellow-400 text-xl">★★★★★</div>}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t mt-4 flex justify-end gap-2">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2">
                        {isSaving && <Spinner size="sm"/>} Save Quiz
                    </button>
                </div>
            </div>
        </div>
    );
};


const QuizManager: React.FC<QuizManagerProps> = ({ quizzes, onSaveQuiz, onDeleteQuiz, addToast, allClasses, allArms, allRoles, scoreEntries = [], attendanceRecords = [], reports = [] }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState<QuizWithQuestions | null>(null);
    const [viewingResultsQuiz, setViewingResultsQuiz] = useState<QuizWithQuestions | null>(null);

    const handleEdit = (quiz: QuizWithQuestions) => {
        setEditingQuiz(quiz);
        setIsModalOpen(true);
    };
    
    const handleDelete = async (id: number) => {
        if (window.confirm('Delete this quiz?')) {
            await onDeleteQuiz(id);
        }
    }

    if (viewingResultsQuiz) {
        return <QuizResultsView 
            quiz={viewingResultsQuiz} 
            onBack={() => setViewingResultsQuiz(null)} 
            addToast={addToast}
            scoreEntries={scoreEntries}
            attendanceRecords={attendanceRecords}
            reports={reports}
        />;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Quiz Manager</h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Create and manage surveys and assessments.</p>
                </div>
                <button onClick={() => { setEditingQuiz(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    <PlusCircleIcon className="w-5 h-5"/> Create Quiz
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.map(quiz => (
                    <div key={quiz.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{quiz.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 h-10">{quiz.description}</p>
                        <p className="text-xs text-slate-400 mt-2">{quiz.questions.length} questions</p>
                        
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button onClick={() => setViewingResultsQuiz(quiz)} className="text-sm font-medium text-purple-600 hover:underline">Results</button>
                            <button onClick={() => handleEdit(quiz)} className="text-sm font-medium text-blue-600 hover:underline">Edit</button>
                            <button onClick={() => handleDelete(quiz.id)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                        </div>
                    </div>
                ))}
                {quizzes.length === 0 && (
                    <div className="col-span-full text-center py-16 border border-dashed rounded-xl">
                        <p className="text-slate-500">No quizzes created yet.</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <QuizBuilderModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={onSaveQuiz}
                    existingQuiz={editingQuiz}
                    addToast={addToast}
                    allClasses={allClasses}
                    allArms={allArms}
                    allRoles={allRoles}
                />
            )}
        </div>
    );
};

export default QuizManager;
