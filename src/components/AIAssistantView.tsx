import React, { useState, useRef, useEffect } from 'react';
import { getAIClient } from '../services/aiClient';
import { TaskPriority, type UserProfile, type Student, type ReportRecord, type AssistantMessage } from '../types';
import { WandIcon, PaperAirplaneIcon } from './common/icons';
import Spinner from './common/Spinner';
import { textFromAI } from '../utils/ai';

interface AIAssistantViewProps {
  userProfile: UserProfile;
  users: UserProfile[];
  students: Student[];
  reports: ReportRecord[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  handleAddTask: (taskData: { title: string, description: string | null, due_date: string, priority: TaskPriority, user_id: string }) => Promise<boolean>;
  handleAddAnnouncement: (title: string, content: string) => Promise<void>;
}

const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  userProfile,
  users,
  students,
  reports,
  addToast,
  handleAddTask,
  handleAddAnnouncement,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { id: 'initial', sender: 'ai', text: `Hello ${userProfile.name.split(' ')[0]}! I'm Guardian Command, your UPSS-GPT assistant. How can I assist you today? You can ask me to create tasks, post announcements, or summarize information.` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: AssistantMessage = { id: Date.now().toString(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
        const aiClient = getAIClient();
        if (!aiClient) {
            throw new Error("AI Client not available");
        }
        
        const systemPrompt = `You are UPSS-GPT — the private AI assistant for University Preparatory Secondary School (UPSS), operating in "Guardian Command" mode.
You are assisting ${userProfile.name}, a ${userProfile.role}.
Your mission is to provide helpful information and suggestions. Be helpful, concise, and professional.
Current date is ${new Date().toLocaleDateString()}.
Available staff: ${users.map(u => `${u.name} (${u.role})`).join(', ')}.
Recent reports summary: ${reports.slice(0, 3).map(r => r.analysis?.summary).filter(Boolean).join('; ')}.

Note: This is a simplified version. Advanced features like task creation and announcements are temporarily disabled during the OpenRouter migration.`;
        
        const conversationHistory = messages
            .filter(m => m.sender !== 'tool_code')
            .map(m => ({
                role: m.sender === 'ai' ? 'assistant' as const : 'user' as const,
                content: m.text
            }));

        const response = await aiClient.chat.completions.create({
            model: 'openai/gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                ...conversationHistory,
                { role: 'user', content: currentInput }
            ],
            max_tokens: 500
        });

        const aiResponse = textFromAI(response);
        setMessages(prev => [...prev, { id: `${Date.now()}-ai`, sender: 'ai', text: aiResponse }]);
    } catch (error) {
        console.error("AI Assistant error:", error);
        setMessages(prev => [...prev, { id: `${Date.now()}-error`, sender: 'ai', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/60 dark:bg-slate-900/40 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-800/60">
        <header className="flex items-center justify-between p-4 border-b border-slate-200/60 dark:border-slate-800/60">
            <h2 className="text-lg font-bold flex items-center gap-2"><WandIcon className="w-5 h-5 text-blue-500" /> Guardian Command</h2>
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
  );
};

export default AIAssistantView;