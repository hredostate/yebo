
import React, { useState, useRef, useEffect } from 'react';
// Temporarily disabled during OpenRouter migration
import { aiClient } from '../services/aiClient';
import type { UserProfile, Student, ReportRecord, Task, RoleDetails, Announcement, AssistantMessage, RoleTitle, BaseDataObject, LivingPolicySnippet, NavigationContext } from '../types';
import { TaskPriority } from '../types';
import { WandIcon, CloseIcon, PaperAirplaneIcon } from './common/icons';
import Spinner from './common/Spinner';
import { textFromGemini } from '../utils/ai';
import { PRINCIPAL_PERSONA_PROMPT, VIEWS } from '../constants';

// Helper to find class by name
const findClassByName = (classes: BaseDataObject[], className: string): BaseDataObject | undefined => {
    const normalizedClassName = className.toLowerCase().replace(/\s+/g, '');
    return classes.find(c => c.name.toLowerCase().replace(/\s+/g, '') === normalizedClassName);
}

// Helper: Get Monday of the current week as a string
const getWeekStartDateString = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay(); // Sunday - 0, Monday - 1
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};


interface AICopilotProps {
  userProfile: UserProfile;
  users: UserProfile[];
  students: Student[];
  reports: ReportRecord[];
  tasks: Task[];
  roles: Record<string, RoleDetails>;
  announcements: Announcement[];
  classes: BaseDataObject[];
  livingPolicy: LivingPolicySnippet[];
  onAddTask: (taskData: any) => Promise<boolean>;
  onAddAnnouncement: (title: string, content: string) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (context: NavigationContext) => void;
  isPageView?: boolean;
}

const AICopilot: React.FC<AICopilotProps> = (props) => {
  const { isPageView = false } = props;
  const [isOpen, setIsOpen] = useState(isPageView);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { id: 'initial', sender: 'ai', text: `Hello! I'm your AI Copilot. How can I help you today?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Local Tool Implementations ---
  const getNonCompliantTeachers = () => {
    const weekStart = new Date(getWeekStartDateString(new Date()));
    const reportingRoles = Object.values(props.roles).filter((r: RoleDetails) => r.reportingQuotaCount && r.reportingQuotaDays);
    const reportingUsers = props.users.filter(u => reportingRoles.some((r: RoleDetails) => r.title === u.role));
    
    const nonCompliant = reportingUsers.filter(user => {
        const reportsInPeriod = props.reports.filter(r => r.author_id === user.id && new Date(r.created_at) >= weekStart);
        return reportsInPeriod.length === 0; // Simplified: just checks for at least one report this week
    }).map(u => u.name);

    return JSON.stringify({ nonCompliantTeachers: nonCompliant });
  };

  const generateWeeklySummaryForClass = (className: string) => {
    const targetClass = findClassByName(props.classes, className);
    if (!targetClass) {
      return JSON.stringify({ error: `Class '${className}' not found.` });
    }
    const weekStart = new Date(getWeekStartDateString(new Date()));
    
    // This is a placeholder for a more complex student-to-class mapping
    const studentsInClass = props.students.filter(s => {
        const studentGrade = `grade ${s.grade}`;
        const studentClassName = targetClass.name.toLowerCase();
        return studentClassName.includes(String(s.grade)) || studentClassName.includes(studentGrade);
    });
    const studentIds = new Set(studentsInClass.map(s => s.id));

    const relevantReports = props.reports.filter(r => 
        new Date(r.created_at) >= weekStart &&
        r.involved_students.some((s: any) => studentIds.has(typeof s === 'number' ? s : s?.id))
    );

    const summaryData = {
        className: targetClass.name,
        weekOf: weekStart.toLocaleDateString(),
        totalStudents: studentsInClass.length,
        reportsCount: relevantReports.length,
        positiveReports: relevantReports.filter(r => r.analysis?.sentiment === 'Positive').length,
        negativeReports: relevantReports.filter(r => r.analysis?.sentiment === 'Negative').length,
        keyIncidents: relevantReports.filter(r => r.report_type === 'Incident').map(r => r.analysis?.summary).slice(0, 2),
    };

    return JSON.stringify(summaryData);
  };

  const draftParentMessage = async (topic: string) => {
      if (!aiClient) return JSON.stringify({ error: "AI client not available." });
      const prompt = `Draft a professional and friendly message for parents about an upcoming school event: "${topic}". The message should be suitable for a school bulletin board or email. Include a placeholder for the date and time.`;
      const response = await aiClient.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      return JSON.stringify({ draft: textFromGemini(response) });
  };
  
  const handleNavigation = (viewName: string, contextData: any) => {
      // Map generic AI intents to specific app views
      let targetView = '';
      
      switch(viewName) {
          case 'submit_report': targetView = VIEWS.SUBMIT_REPORT; break;
          case 'create_task': targetView = 'create_task_modal'; break; // Special key handled in App.tsx
          case 'student_profile': targetView = VIEWS.STUDENT_ROSTER; break;
          case 'dashboard': targetView = VIEWS.DASHBOARD; break;
          case 'report_feed': targetView = VIEWS.REPORT_FEED; break;
          case 'lesson_planner': targetView = VIEWS.LESSON_PLANNER; break;
          default: targetView = VIEWS.DASHBOARD;
      }

      props.onNavigate({
          targetView,
          data: contextData
      });
      
      return JSON.stringify({ success: true, message: `Navigating to ${targetView}...` });
  }
  
  // --- Gemini Tool Declarations ---
  const tools: { functionDeclarations: FunctionDeclaration[] }[] = [{
      functionDeclarations: [
        {
          name: 'generateWeeklySummary',
          description: 'Generates a summary of activities for a specific class for the current week.',
          parameters: {
            type: Type.OBJECT,
            properties: { className: { type: Type.STRING, description: 'The name of the class, e.g., "JSS1", "SS 2".' } },
            required: ['className'],
          },
        },
        {
          name: 'showNonCompliantTeachers',
          description: 'Lists teachers who have not submitted their required reports this week.',
          parameters: { type: Type.OBJECT, properties: {} },
        },
        {
          name: 'draftParentMessage',
          description: 'Drafts a message to parents about a specific topic.',
          parameters: {
            type: Type.OBJECT,
            properties: { topic: { type: Type.STRING, description: 'The subject of the message, e.g., "Science Fair", "PTA Meeting".' } },
            required: ['topic'],
          },
        },
        {
            name: 'navigate_app',
            description: 'Navigates the user to a specific feature or page in the app to perform an action. Use this when the user wants to "go to", "open", "create", or "submit" something.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    viewName: { 
                        type: Type.STRING, 
                        enum: ['submit_report', 'create_task', 'student_profile', 'dashboard', 'report_feed', 'lesson_planner'],
                        description: 'The internal name of the view to navigate to.' 
                    },
                    contextData: {
                        type: Type.OBJECT,
                        description: 'Data extracted from the user request to pre-fill the form or filter the view.',
                        properties: {
                            studentName: { type: Type.STRING, description: 'Name of the student involved.' },
                            reportText: { type: Type.STRING, description: 'Initial text for a report.' },
                            reportType: { type: Type.STRING, description: 'Type of report (e.g., Incident, Observation).' },
                            taskTitle: { type: Type.STRING, description: 'Title for a new task.' },
                            taskDescription: { type: Type.STRING, description: 'Description for a new task.' },
                            priority: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Critical'] }
                        }
                    }
                },
                required: ['viewName']
            }
        }
      ]
  }];
  
  // --- Main Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: AssistantMessage = { id: Date.now().toString(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
        if (!aiClient) throw new Error("AI Client not available");
        
        const livingPolicyContext = props.livingPolicy.map(p => `- ${p.content}`).join('\n');

        const systemInstruction = `
            ${PRINCIPAL_PERSONA_PROMPT}

            You are now operating as the AI Copilot for the school. Your persona is that of the Principal described above.
            Your mission is to assist staff by answering questions and executing tasks.
            
            **CONCIERGE CAPABILITIES:**
            - You can navigate the app for the user. If they say "I want to submit a report about John" or "Remind me to call Mrs. Smith", DO NOT just say you will do it. Call the \`navigate_app\` tool with the correct view and extracted data.
            - For reports, extract the student name and the report details.
            - For tasks, extract the title and description.
            
            - Answer questions based on the context provided (recent reports, staff list, etc.) and the Living Policy knowledge base.
            - If a user asks you to do something that matches an available tool, use the tool.
            - Keep your answers role-appropriate for the user you are talking to.
            - If you don't know the answer or it's not in your context, say so clearly. Do not invent information.

            CONTEXT:
            - You are assisting: ${props.userProfile.name}, a ${props.userProfile.role}.
            - Current date is: ${new Date().toLocaleDateString()}.
            - Living Policy Knowledge Base:
            ${livingPolicyContext || 'No policy information available.'}
            
            - Available staff: ${props.users.map(u => `${u.name} (${u.role})`).join(', ')}.
            - Recent reports summary: ${props.reports.slice(0, 3).map(r => r.analysis?.summary).filter(Boolean).join('; ')}.
        `;
        
        const history: Content[] = messages.map(m => ({
            role: m.sender === 'ai' ? 'model' as const : 'user' as const,
            parts: [{ text: m.text }]
        }));

        const response: GenerateContentResponse = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [...history, { role: 'user', parts: [{ text: currentInput }] }],
            config: { systemInstruction, tools }
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
            const fc = response.functionCalls[0];
            let toolResult = '';
            
            setMessages(prev => [...prev, { id: `${Date.now()}-tool`, sender: 'ai', text: `One moment, I'm taking care of that...` }]);

            if (fc.name === 'showNonCompliantTeachers') {
                toolResult = getNonCompliantTeachers();
            } else if (fc.name === 'generateWeeklySummary') {
                toolResult = generateWeeklySummaryForClass(fc.args.className as string);
            } else if (fc.name === 'draftParentMessage') {
                toolResult = await draftParentMessage(fc.args.topic as string);
            } else if (fc.name === 'navigate_app') {
                toolResult = handleNavigation(fc.args.viewName as string, fc.args.contextData);
                // We can close the copilot or keep it open. For navigation, it's nice to minimize it so the user sees the change.
                setIsOpen(false);
            }
            
            const secondResponse = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    ...history,
                    { role: 'user', parts: [{ text: currentInput }] },
                    { role: 'model', parts: [{ functionCall: fc }] },
                    { role: 'user', parts: [{ functionResponse: { name: fc.name, response: { result: JSON.parse(toolResult) } } }] }
                ],
                config: { systemInstruction, tools }
            });
            setMessages(prev => [...prev, { id: `${Date.now()}-ai`, sender: 'ai', text: textFromGemini(secondResponse) }]);
        } else {
            setMessages(prev => [...prev, { id: `${Date.now()}-ai`, sender: 'ai', text: textFromGemini(response) }]);
        }
    } catch (error) {
        console.error("AI Copilot error:", error);
        setMessages(prev => [...prev, { id: `${Date.now()}-error`, sender: 'ai', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      {/* Only show floating button if NOT page view */}
      {!isPageView && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-transform hover:scale-110"
          aria-label="Toggle AI Copilot"
        >
          <WandIcon className="w-8 h-8" />
        </button>
      )}

      {/* Chat panel - modify positioning for page view */}
      <div className={`${isPageView ? 'relative w-full h-full' : 'fixed top-0 right-0 h-full w-full max-w-md'} bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl border-l border-slate-200/60 dark:border-slate-800/60 z-50 flex flex-col transition-transform duration-300 ease-in-out ${isPageView || isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="flex items-center justify-between p-4 border-b border-slate-200/60 dark:border-slate-800/60">
          <h2 className="text-lg font-bold flex items-center gap-2"><WandIcon className="w-5 h-5 text-blue-500" /> AI Copilot</h2>
          {!isPageView && <button onClick={() => setIsOpen(false)}><CloseIcon className="w-6 h-6" /></button>}
        </header>

        <div className="flex-grow p-4 space-y-4 overflow-y-auto">
            {messages.map(msg => (
                <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                    {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm ring-2 ring-blue-300/50 flex-shrink-0">AI</div>}
                    <div className={`max-w-xs md:max-w-sm p-3 rounded-xl ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-500/10 text-slate-800 dark:text-slate-200'}`}>
                        <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm ring-2 ring-blue-300/50 flex-shrink-0">AI</div>
                    <div className="p-3 rounded-xl bg-slate-500/10"><Spinner size="sm" /></div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        <footer className="p-4 border-t border-slate-200/60 dark:border-slate-800/60">
            <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask me anything..."
                    className="flex-grow p-3 text-sm border border-slate-300/60 dark:border-slate-700/60 rounded-xl bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                />
                <button type="submit" className="p-3 bg-blue-600 text-white rounded-lg disabled:bg-blue-400" disabled={isLoading || !input.trim()}>
                    <PaperAirplaneIcon className="w-5 h-5" />
                </button>
            </form>
        </footer>
      </div>
    </>
  );
};

export default AICopilot;