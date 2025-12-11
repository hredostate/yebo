




import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ReportType, type Student, type UserProfile } from '../types';
import Spinner from './common/Spinner';
import { CloseIcon, WandIcon } from './common/icons';
import { aiClient } from '../services/aiClient';
import { VIEWS } from '../constants';
import { textFromGemini } from '../utils/ai';

interface ReportFormProps {
  students: Student[];
  users: UserProfile[];
  onSubmit: (data: { 
    report_text: string; 
    report_type: ReportType; 
    involved_students: number[];
    involved_staff: string[];
    tagged_users: { user_id: string; name: string; type: 'staff' | 'student' }[];
    image_data: { base64: string, mimeType: string } | null 
  }) => Promise<void>;
  onCancel: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  initialData?: {
      studentName?: string;
      reportText?: string;
      reportType?: string;
  };
}

// Constants for mention feature
const MAX_MENTION_RESULTS = 5;
const MENTION_REGEX = /@([a-zA-Z0-9\s\-'À-ÿ]*)$/;

const ReportForm: React.FC<ReportFormProps> = ({ students, users, onSubmit, onCancel, addToast, initialData }) => {
  const [reportText, setReportText] = useState('');
  const [reportType, setReportType] = useState<ReportType>(ReportType.Observation);
  
  // State for mentions
  const [taggedUsers, setTaggedUsers] = useState<{ id: string | number; name: string; type: 'staff' | 'student' }[]>([]);
  const [isMentioning, setIsMentioning] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // General form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // --- Initial Data Auto-Fill (AI Navigation) ---
  useEffect(() => {
      if (initialData) {
          if (initialData.reportText) {
              setReportText(initialData.reportText);
          }
          
          if (initialData.reportType) {
              // Basic mapping, could be smarter with fuzzy matching if AI is imprecise
              const matchedType = Object.values(ReportType).find(t => t.toLowerCase() === initialData.reportType?.toLowerCase());
              if (matchedType) setReportType(matchedType);
          }

          if (initialData.studentName) {
              // Try to find student and auto-tag
              const query = initialData.studentName.toLowerCase();
              // Prioritize exact matches, then contains
              const foundStudent = students.find(s => s.name.toLowerCase() === query) || 
                                   students.find(s => s.name.toLowerCase().includes(query));
              
              if (foundStudent) {
                  const tag = { id: foundStudent.id, name: foundStudent.name, type: 'student' as const };
                  // Prevent duplicates
                  setTaggedUsers(prev => prev.some(t => t.id === tag.id) ? prev : [...prev, tag]);
                  addToast(`Auto-tagged student: ${foundStudent.name}`, 'info');
              }
          }
      }
  }, [initialData, students, addToast]);


  const mentionables = useMemo(() => [
      ...users.map(u => ({ id: u.id, name: u.name, type: 'staff' as const, details: u.role })),
      ...students.map(s => ({ id: s.id, name: s.name, type: 'student' as const, details: `Grade ${s.grade}` }))
  ], [users, students]);

  const filteredMentionables = useMemo(() => {
    // If mentioning but no query yet, show first MAX_MENTION_RESULTS results
    if (isMentioning && !mentionQuery) {
        return mentionables.slice(0, MAX_MENTION_RESULTS);
    }
    if (!mentionQuery) return [];
    const query = mentionQuery.toLowerCase();
    return mentionables.filter(p => p.name.toLowerCase().includes(query)).slice(0, MAX_MENTION_RESULTS);
  }, [mentionQuery, mentionables, isMentioning]);

  useEffect(() => {
      setMentionIndex(0);
  }, [filteredMentionables]);

  // Development debugging - log data availability on mount
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
        console.log('[ReportForm] Mounted with:', {
            studentsCount: students.length,
            usersCount: users.length,
            mentionablesCount: mentionables.length
        });
    }
  }, [students.length, users.length, mentionables.length]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) {
      addToast('Report text cannot be empty.', 'error');
      return;
    }
    setIsSubmitting(true);
    
    const taggedStaffIds = taggedUsers.filter(u => u.type === 'staff').map(u => u.id as string);
    const taggedStudentIds = taggedUsers.filter(u => u.type === 'student').map(u => u.id as number);

    await onSubmit({
      report_text: reportText,
      report_type: reportType,
      involved_students: taggedStudentIds,
      involved_staff: taggedStaffIds,
      tagged_users: taggedUsers.map(u => ({ user_id: String(u.id), name: u.name, type: u.type })),
      image_data: imageData ? { base64: imageData.base64, mimeType: imageData.mimeType } : null,
    });
    setIsSubmitting(false);
  };
  
  const handleEnhanceReport = async () => {
    if (!reportText.trim() || isEnhancing || isSubmitting) return;

    setIsEnhancing(true);
    try {
      if (!aiClient) {
        throw new Error("AI Client is not available.");
      }

      const prompt = `You are an expert in writing school incident reports. Your task is to enhance the following report text.
      Make it more objective, clear, and professional. Add relevant details that could be logically inferred but DO NOT invent new facts or contradict the original report.
      Structure the output for maximum clarity using clear paragraphs. Avoid using markdown like asterisks for emphasis; use well-structured sentences instead.
      
      Original Report:
      "${reportText}"
      
      Enhanced Report:`;

      const response = await aiClient.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      
      setReportText(textFromGemini(response));
      addToast('Report enhanced by AI.', 'success');

    } catch (error) {
      console.error("AI enhancement error:", error);
      addToast('Failed to enhance report with AI.', 'error');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setReportText(text);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    // Support letters, numbers, spaces, hyphens, apostrophes, and common accented chars
    const mentionMatch = textBeforeCursor.match(MENTION_REGEX);

    if (mentionMatch) {
      setIsMentioning(true);
      setMentionQuery(mentionMatch[1]);
    } else {
      setIsMentioning(false);
    }
  };

  const handleSelectMention = (person: { id: string | number; name: string; type: 'staff' | 'student' }) => {
    if (taggedUsers.some(u => u.id === person.id)) {
        addToast(`${person.name} is already tagged.`, 'info');
    } else {
        setTaggedUsers(prev => [...prev, person]);
    }

    const textarea = textareaRef.current;
    if (textarea) {
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = reportText.substring(0, cursorPos);
        const textAfterCursor = reportText.substring(cursorPos);
        
        // Replace the mention query with the person's name
        const textBeforeMention = textBeforeCursor.replace(MENTION_REGEX, '');
        const newText = `${textBeforeMention}@${person.name.replace(/\s+/g, '')} ${textAfterCursor}`;
        
        setReportText(newText);
        
        // Move cursor after the inserted mention
        // We need a small timeout to ensure state updates and DOM renders
        setTimeout(() => {
             // Find new cursor pos
             const newCursorPos = textBeforeMention.length + person.name.replace(/\s+/g, '').length + 2; // +2 for @ and space
             textarea.focus();
             textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    }

    setIsMentioning(false);
    setMentionQuery('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if(isMentioning && filteredMentionables.length > 0) {
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setMentionIndex(prev => (prev + 1) % filteredMentionables.length);
          } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setMentionIndex(prev => (prev - 1 + filteredMentionables.length) % filteredMentionables.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              handleSelectMention(filteredMentionables[mentionIndex]);
          } else if (e.key === 'Escape') {
              e.preventDefault();
              setIsMentioning(false);
          }
      }
  };

  // --- Image & Speech ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        addToast("File is too large. Please select an image under 10MB.", 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const dataUrl = reader.result;
          const base64String = dataUrl.split(',')[1];
          setImageData({ base64: base64String, mimeType: file.type, previewUrl: dataUrl });
        } else {
          addToast('Error: Could not process the image file.', 'error');
          setImageData(null);
        }
      };
      reader.onerror = () => {
        addToast('Error: Could not read the selected image file. It may be corrupted or in an unsupported format.', 'error');
        setImageData(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        const initialText = reportText.trim() ? reportText.trim() + ' ' : '';

        recognition.onresult = (event: any) => {
          let interim_transcript = '';
          let final_transcript = '';
          
          // The Web Speech API returns a cumulative list of results.
          // We must iterate through all of them to rebuild the full transcript.
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final_transcript += event.results[i][0].transcript;
            } else {
              interim_transcript += event.results[i][0].transcript;
            }
          }
          setReportText(initialText + final_transcript + interim_transcript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          addToast('Speech recognition error: ' + event.error, 'error');
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsListening(true);
      } else {
        addToast('Speech recognition is not supported in this browser.', 'info');
      }
    }
  };
  
  // --- Constants & Helpers ---
  const reportTypes: ReportType[] = Object.values(ReportType);
  const formElementClasses = "w-full p-2 border rounded-xl shadow-sm bg-white/50 dark:bg-slate-800/50 border-slate-300/60 dark:border-slate-700/60 focus:ring-blue-500 focus:border-blue-500";
  const labelClasses = "block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1";

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 animate-fade-in max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">Submit a New Report</h1>
      
      {initialData && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <WandIcon className="w-4 h-4" />
              <span>Form pre-filled by AI Copilot based on your request.</span>
          </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="reportType" className={labelClasses}>Report Type</label>
          <select id="reportType" value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className={formElementClasses}>
            {reportTypes.map(type => <option key={type} value={type} className="dark:bg-slate-800">{type}</option>)}
          </select>
        </div>

        <div className="relative">
          <label htmlFor="reportText" className={labelClasses}>Details</label>
          <p className="text-xs text-slate-500 mb-2">Tag people by typing '@' followed by their name.</p>
          <div className="relative">
              <textarea
                id="reportText"
                ref={textareaRef}
                value={reportText}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                rows={12}
                className={`${formElementClasses} leading-relaxed`}
                placeholder="Provide a clear and objective description of the event..."
                disabled={isEnhancing || isSubmitting}
              />
               {isMentioning && filteredMentionables.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 z-10 w-full max-w-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredMentionables.map((p, index) => (
                    <div 
                        key={p.id} 
                        onClick={() => handleSelectMention(p)} 
                        className={`p-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${index === mentionIndex ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                    >
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.details}</p>
                    </div>
                  ))}
                </div>
              )}
              {isMentioning && mentionQuery && filteredMentionables.length === 0 && (
                <div className="absolute bottom-full left-0 mb-1 z-10 w-full max-w-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg p-3 text-sm text-slate-500">
                    No matching students or staff found for "@{mentionQuery}"
                </div>
              )}
          </div>
          <div className="absolute bottom-3 right-3 flex items-center space-x-2">
              <button type="button" onClick={handleEnhanceReport} title="Enhance with AI" disabled={!reportText.trim() || isEnhancing || isSubmitting} className="p-2 rounded-full transition-colors bg-purple-500/20 text-purple-600 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-9 h-9">
                  {isEnhancing ? <Spinner size="sm" /> : <WandIcon className="w-5 h-5" />}
              </button>
              <button type="button" onClick={toggleListening} title="Use Voice to Text" className={`p-2 rounded-full transition-colors flex items-center justify-center w-9 h-9 ${isListening ? 'bg-red-500/20 text-red-600 animate-pulse' : 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30'}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z"></path>
                    <path d="M5.5 13a.5.5 0 01.5.5v1.5a4 4 0 004 4h0a4 4 0 004-4V13.5a.5.5 0 011 0V15a5 5 0 01-5 5h0a5 5 0 01-5 5v-1.5a.5.5 0 01.5-.5z"></path>
                </svg>
              </button>
          </div>
        </div>
        
        {taggedUsers.length > 0 && (
            <div>
                <label className={labelClasses}>Tagged People</label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-xl bg-slate-500/5">
                    {taggedUsers.map(u => (
                        <span key={u.id} className="bg-blue-500/20 text-blue-800 dark:text-blue-200 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                            {u.name}
                            <button type="button" onClick={() => setTaggedUsers(prev => prev.filter(p => p.id !== u.id))} className="ml-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100 font-bold">&times;</button>
                        </span>
                    ))}
                </div>
            </div>
        )}

        <div>
            <label className={labelClasses}>Attach Image</label>
            {imageData ? (
                 <div className="relative group">
                    <img src={imageData.previewUrl} alt="Report preview" className="mt-1 w-full max-h-60 object-contain rounded-md border border-slate-300/60 dark:border-slate-700/60" />
                    <button onClick={() => setImageData(null)} className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><CloseIcon className="w-5 h-5" /></button>
                </div>
            ) : (
                <input type="file" accept="image/*" onChange={handleImageChange} className={formElementClasses} />
            )}
        </div>

        <div className="flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="px-6 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30 transition-colors">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center transition-colors shadow-lg shadow-blue-500/30">
            {isSubmitting ? <Spinner size="sm" /> : 'Submit Report'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportForm;
