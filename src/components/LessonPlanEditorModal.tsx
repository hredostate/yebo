
import React, { useState, useEffect } from 'react';
import type { LessonPlan, LessonPlanSession } from '../types';
import { SubmissionStatus } from '../types';
import Spinner from './common/Spinner';
import { lessonPlanTemplate, sessionTemplate } from '../lessonPlanTemplate';
import { WandIcon } from './common/icons';

interface LessonPlanEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: Partial<LessonPlan>, generateWithAi: boolean, file: File | null) => Promise<LessonPlan | null>;
  initialPlanData: Partial<LessonPlan> | null;
}

const LessonPlanEditorModal: React.FC<LessonPlanEditorModalProps> = ({ isOpen, onClose, onSave, initialPlanData }) => {
  const [planData, setPlanData] = useState<Partial<LessonPlan>>({});
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Initialize form state when modal opens or initial data changes
    if (isOpen && initialPlanData) {
      setPlanData({
        ...initialPlanData,
        sessions: initialPlanData.sessions || [], // Ensure sessions is an array
      });
      setFile(null); // Reset file when modal opens
    } else {
      setPlanData({ sessions: [] });
      setFile(null);
    }
  }, [initialPlanData, isOpen]);

  const handleSave = async (generateWithAi: boolean) => {
    if (!planData) return;
    
    if (generateWithAi) {
        setIsGenerating(true);
    } else {
        setIsSaving(true);
    }
    
    // Set submission status based on due date logic (simplified here)
    const submission_status = planData.id ? planData.submission_status : SubmissionStatus.OnTime;
    
    const result = await onSave({ ...planData, submission_status }, generateWithAi, file);
    
    setIsSaving(false);
    setIsGenerating(false);

    if (result) {
      onClose();
    }
  };

  const handleFieldChange = (field: keyof LessonPlan, value: any) => {
    setPlanData(prev => ({ ...prev, [field]: value }));
  };

  const handleSessionChange = (index: number, field: keyof LessonPlanSession, value: any) => {
    setPlanData(prev => {
      const newSessions = [...(prev.sessions || [])];
      newSessions[index] = { ...(newSessions[index] as LessonPlanSession), [field]: value };
      return { ...prev, sessions: newSessions };
    });
  };

  const addSession = () => {
    const newSession: LessonPlanSession = {
      title: 'New Session',
      scope: '',
      goals: '',
      hook: '',
      active_learning: { description: '', objective: '', materials: '', steps: [] },
      real_world_connection: '',
      peer_review: '',
      worksheet: { title: '', objective: '', items: [] },
      core_vocabulary: { list: [], usageNotes: '' },
      board_summary: { narrative: '', answer_key: [] },
      mcqs: [],
      theory_questions: [],
    };
    setPlanData(prev => ({ ...prev, sessions: [...(prev.sessions || []), newSession] }));
  };

  const removeSession = (index: number) => {
    setPlanData(prev => ({ ...prev, sessions: (prev.sessions || []).filter((_, i) => i !== index) }));
  };

  if (!isOpen) return null;

  const inputClasses = "w-full p-2 border rounded-md bg-white/50 dark:bg-slate-800/50 border-slate-300/60 dark:border-slate-700/60 focus:ring-blue-500 focus:border-blue-500";
  const labelClasses = "block text-sm font-medium text-slate-700 dark:text-slate-200";
  const textareaClasses = `${inputClasses} min-h-[80px]`;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-4xl m-4 flex flex-col max-h-[90vh]">
        <h2 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white">{planData.id ? 'Edit' : 'Create'} Lesson Plan</h2>
        <p className="text-sm text-slate-500 mb-4">For week of {initialPlanData?.week_start_date}</p>
        
        <div className="flex-grow space-y-4 overflow-y-auto pr-2">
          {/* Main Plan Fields - Dynamically rendered */}
          {lessonPlanTemplate.fields.map(field => (
            <div key={field.name}>
              <label htmlFor={field.name} className={labelClasses}>{field.label}</label>
              {field.type === 'textarea' ? (
                <textarea 
                  id={field.name} 
                  placeholder={field.placeholder} 
                  value={(planData as any)[field.name] || ''} 
                  onChange={e => handleFieldChange(field.name as keyof LessonPlan, e.target.value)} 
                  className={textareaClasses} 
                  rows={field.rows || 3}
                />
              ) : (
                <input 
                  id={field.name} 
                  type="text" 
                  placeholder={field.placeholder} 
                  value={(planData as any)[field.name] || ''} 
                  onChange={e => handleFieldChange(field.name as keyof LessonPlan, e.target.value)} 
                  className={inputClasses}
                />
              )}
            </div>
          ))}

          {/* PDF File Upload */}
          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
            <label htmlFor="file-upload" className={labelClasses}>Attach PDF (Optional)</label>
            <p className="text-xs text-slate-500 mb-2">Upload a PDF document for this lesson plan.</p>
            <input 
              id="file-upload"
              type="file"
              accept=".pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300 dark:hover:file:bg-blue-900/50"
            />
            {file && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Selected: {file.name}</p>
            )}
          </div>

          {/* Sessions - Repeatable Block */}
          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">{sessionTemplate.label}</h3>
            
            <button type="button" onClick={addSession} className="w-full py-2 border-2 border-dashed rounded-lg text-slate-600 hover:bg-slate-500/10 mb-4">
                + Add Session
            </button>

            <div className="space-y-4">
              {(planData.sessions || []).map((session, index) => (
                <div key={index} className="p-4 border rounded-lg bg-slate-500/5 relative">
                  <button type="button" onClick={() => removeSession(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold">&times;</button>
                  <h4 className="font-semibold mb-2">Session {index + 1}</h4>
                  <div className="space-y-3">
                    {sessionTemplate.itemTemplate.fields.map(field => (
                       <div key={field.name}>
                        <label htmlFor={`session-${index}-${field.name}`} className={labelClasses}>{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea 
                            id={`session-${index}-${field.name}`} 
                            placeholder={field.placeholder}
                            value={(session as any)[field.name] || ''} 
                            onChange={e => handleSessionChange(index, field.name as keyof LessonPlanSession, e.target.value)} 
                            className={textareaClasses} 
                            rows={field.rows || 2}
                          />
                        ) : (
                          <input
                            id={`session-${index}-${field.name}`}
                            type="text" 
                            placeholder={field.placeholder}
                            value={(session as any)[field.name] || ''} 
                            onChange={e => handleSessionChange(index, field.name as keyof LessonPlanSession, e.target.value)} 
                            className={inputClasses}
                          />
                        )}
                       </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Coverage Tracking - Informational Only */}
          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Coverage Tracking</h3>
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong>Note:</strong> Coverage is now tracked separately through the Coverage Reporting Panel. 
                After teaching this lesson plan, use the Coverage Reporting Panel to report coverage status for each class/arm.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
          <button onClick={onClose} disabled={isSaving || isGenerating} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-md disabled:opacity-50">Cancel</button>
          <button onClick={() => handleSave(false)} disabled={isSaving || isGenerating} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-blue-400 flex items-center min-w-[80px] justify-center">
            {isSaving ? <Spinner size="sm" /> : 'Save'}
          </button>
           <button onClick={() => handleSave(true)} disabled={isSaving || isGenerating} className="px-4 py-2 bg-purple-600 text-white rounded-md disabled:bg-purple-400 flex items-center min-w-[200px] justify-center gap-2">
            {isGenerating ? <Spinner size="sm" /> : <WandIcon className="w-5 h-5"/>}
            {isGenerating ? 'Generating...' : 'Save & Generate with AI'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonPlanEditorModal;
