
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAIClient } from '../services/aiClient';
import { textFromAI } from '../utils/ai';
import { extractAndParseJson } from '../utils/json';
import type { SocialMediaAnalytics, SocialAccount, PlatformTask, VideoSuggestion, PerformanceAnalysis, UserProfile } from '../types';
import { TaskPriority, TaskStatus } from '../types';
import Spinner from './common/Spinner';

// --- Modal for Implementing Video Ideas ---
interface ImplementIdeaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (dueDate: string) => Promise<void>;
    idea: VideoSuggestion | null;
}

const ImplementIdeaModal: React.FC<ImplementIdeaModalProps> = ({ isOpen, onClose, onSubmit, idea }) => {
    const [dueDate, setDueDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Set default due date to 3 days from now
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 3);
            setDueDate(defaultDate.toISOString().split('T')[0]);
        }
    }, [isOpen]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dueDate) return;
        setIsSaving(true);
        await onSubmit(dueDate);
        setIsSaving(false);
    };

    if (!isOpen || !idea) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-lg m-4 space-y-4">
                <h2 className="text-xl font-bold">Create Task for Video Idea</h2>
                <p className="text-sm bg-slate-500/10 p-2 rounded-md"><strong>Idea:</strong> {idea.idea}</p>
                <div>
                    <label htmlFor="due-date" className="block text-sm font-medium">Set a Due Date</label>
                    <input
                        type="date"
                        id="due-date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        required
                        className="mt-1 w-full p-2 border rounded-md"
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md">Cancel</button>
                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center min-w-[120px] justify-center">
                        {isSaving ? <Spinner size="sm" /> : 'Create Task'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Widget Components
interface ContentPlannerWidgetProps {
    onGenerate: (topic: string) => Promise<void>;
    tasks: PlatformTask[];
}

const ContentPlannerWidget: React.FC<ContentPlannerWidgetProps> = ({ onGenerate, tasks }) => {
    const [topic, setTopic] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) return;
        setIsLoading(true);
        await onGenerate(topic);
        setIsLoading(false);
    };
    
    return (
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 flex-1 flex flex-col">
            <h3 className="font-bold text-slate-800 dark:text-white mb-3 text-lg">🗓️ AI Content Planner</h3>
            <form onSubmit={handleSubmit} className="flex space-x-2 mb-4">
                <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Enter event topic..."
                    className="flex-grow p-2 text-sm border border-slate-300/60 dark:border-slate-700/60 rounded-md bg-white/50 dark:bg-slate-800/50"
                    disabled={isLoading}
                />
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400" disabled={isLoading || !topic.trim()}>
                    {isLoading ? <Spinner size="sm" /> : 'Generate'}
                </button>
            </form>
            <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                {tasks.length > 0 ? (
                    tasks.map((task, index) => (
                         <div key={index} className="p-3 bg-slate-500/10 rounded-lg">
                             <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">{task.platform}</p>
                             <p className="text-sm text-slate-700 dark:text-slate-200">{task.taskDescription}</p>
                         </div>
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-500 dark:text-slate-400">Enter a topic to generate a platform-specific posting plan.</div>
                )}
            </div>
        </div>
    );
};

interface VideoTrendSuggesterWidgetProps {
    onGenerate: () => Promise<void>;
    suggestions: VideoSuggestion[];
    onImplement: (suggestion: VideoSuggestion) => void;
}

const VideoTrendSuggesterWidget: React.FC<VideoTrendSuggesterWidgetProps> = ({ onGenerate, suggestions, onImplement }) => {
    const [isLoading, setIsLoading] = useState(false);
    const handleGenerate = async () => {
        setIsLoading(true);
        await onGenerate();
        setIsLoading(false);
    };

    return (
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">💡 Video Trend Suggester</h3>
                <button onClick={handleGenerate} className="px-4 py-2 text-sm bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-purple-400" disabled={isLoading}>
                    {isLoading ? <Spinner size="sm" /> : 'Get Fresh Ideas'}
                </button>
            </div>
             <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                {suggestions.length > 0 ? (
                     suggestions.map((s, index) => (
                         <div key={index} className="p-3 bg-purple-500/10 border-l-4 border-purple-400/50 rounded-r-lg">
                            <p className="text-xs font-semibold uppercase text-purple-700 dark:text-purple-300">Trend: {s.trend}</p>
                            <p className="font-semibold text-sm text-slate-800 dark:text-white mt-1">{s.idea}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic mt-1">"{s.example}"</p>
                            <div className="text-right mt-2">
                                <button onClick={() => onImplement(s)} className="px-3 py-1 text-xs bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700">Implement</button>
                            </div>
                         </div>
                     ))
                ) : (
                    <div className="text-center py-10 text-slate-500 dark:text-slate-400">Click "Get Fresh Ideas" for AI-powered video concepts.</div>
                )}
            </div>
        </div>
    );
}

interface PerformanceAnalyticsWidgetProps {
    analytics: SocialMediaAnalytics[];
    accounts: SocialAccount | null;
    onAnalyze: () => Promise<void>;
    analysis: PerformanceAnalysis | null;
    onSaveSocialLinks: (links: SocialAccount) => Promise<void>;
    onGenerateAnalyticsData: () => Promise<void>;
}

const PerformanceAnalyticsWidget: React.FC<PerformanceAnalyticsWidgetProps> = ({ analytics, accounts, onAnalyze, analysis, onSaveSocialLinks, onGenerateAnalyticsData }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [links, setLinks] = useState<SocialAccount>(accounts || { instagram: null, facebook: null, x: null, tiktok: null });

    useEffect(() => {
        setLinks(accounts || { instagram: null, facebook: null, x: null, tiktok: null });
    }, [accounts]);
    
    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        await onAnalyze();
        setIsAnalyzing(false);
    }

    const handleGenerateData = async () => {
        setIsGenerating(true);
        await onGenerateAnalyticsData();
        setIsGenerating(false);
    }
    
    const handleSave = async () => {
        setIsSaving(true);
        await onSaveSocialLinks(links);
        setIsSaving(false);
    }

    const handleLinkChange = (platform: keyof SocialAccount, value: string) => {
        setLinks(prev => {
            const newLinks = { ...prev };
            newLinks[platform] = value || null;
            return newLinks;
        });
    }

    return (
         <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-3">
                 <h3 className="font-bold text-slate-800 dark:text-white text-lg">📈 Performance Analytics</h3>
            </div>
            
            <div className="mb-4">
                <h4 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-2">Connect Your Accounts</h4>
                <div className="space-y-2">
                    {(Object.keys(links) as Array<keyof SocialAccount>).map(platform => (
                         <div key={platform} className="flex items-center space-x-2">
                            <label className="w-24 text-sm capitalize">{platform}</label>
                            <input 
                                type="text" 
                                value={links[platform] || ''}
                                onChange={e => handleLinkChange(platform, e.target.value)}
                                placeholder={`@${platform}_handle`}
                                className="flex-grow p-1.5 text-sm border border-slate-300/60 dark:border-slate-700/60 rounded-md bg-white/50 dark:bg-slate-800/50"
                            />
                        </div>
                    ))}
                </div>
                <button onClick={handleSave} disabled={isSaving} className="mt-2 w-full text-sm px-4 py-2 bg-slate-500/20 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-500/30 disabled:opacity-50">
                    {isSaving ? <Spinner size="sm"/> : 'Save Links'}
                </button>
            </div>
            
            <div className="mb-4">
                <h4 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-2">Simulated Analytics Data</h4>
                 {analytics.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {analytics.map(acc => (
                            <div key={acc.platform} className="p-3 bg-slate-500/10 rounded-lg">
                                <p className="font-bold text-slate-800 dark:text-white">{acc.platform}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{acc.followers.toLocaleString()} Followers</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{acc.engagementRate.toFixed(1)}% Engagement</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center py-4 text-xs text-slate-500 bg-slate-500/10 rounded-lg">No data. Click below to generate some.</p>
                )}
                <button onClick={handleGenerateData} disabled={isGenerating} className="mt-2 w-full text-sm px-4 py-2 bg-slate-500/20 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-500/30 disabled:opacity-50">
                    {isGenerating ? <Spinner size="sm"/> : analytics.length > 0 ? 'Refresh Analytics Data' : 'Generate Analytics Data'}
                </button>
            </div>
            
            <div className="flex-grow flex flex-col overflow-y-auto pr-2 border-t border-slate-200/60 dark:border-slate-700/60 pt-4">
                 <h4 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-2">AI Performance Review</h4>
                <button onClick={handleAnalyze} className="w-full px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-400" disabled={isAnalyzing || analytics.length === 0}>
                    {isAnalyzing ? <Spinner size="sm" /> : 'Analyze Performance'}
                </button>
                <div className="mt-3 flex-grow">
                    {analysis ? (
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-green-700 dark:text-green-300">Strengths</h4>
                                <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-200">
                                    {analysis.strengths.map((s,i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold text-orange-700 dark:text-orange-400">Weaknesses</h4>
                                <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-200">
                                    {analysis.weaknesses.map((s,i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold text-blue-700 dark:text-blue-300">Recommendations</h4>
                                <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-200">
                                    {analysis.recommendations.map((s,i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                           {analytics.length > 0 ? 'Click "Analyze Performance" for an AI summary.' : 'Generate analytics data first.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Main Component ---

interface SocialMediaHubViewProps {
    socialMediaAnalytics: SocialMediaAnalytics[];
    socialAccounts: SocialAccount | null;
    onAddTask: (taskData: any) => Promise<boolean>;
    onSaveSocialLinks: (links: SocialAccount) => Promise<void>;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    users: UserProfile[];
}

const SocialMediaHubView: React.FC<SocialMediaHubViewProps> = ({
    socialMediaAnalytics: initialAnalytics,
    socialAccounts: initialAccounts,
    onAddTask,
    onSaveSocialLinks,
    addToast,
    users
}) => {
    const [platformTasks, setPlatformTasks] = useState<PlatformTask[]>([]);
    const [videoSuggestions, setVideoSuggestions] = useState<VideoSuggestion[]>([]);
    const [performanceAnalysis, setPerformanceAnalysis] = useState<PerformanceAnalysis | null>(null);
    const [analyticsData, setAnalyticsData] = useState<SocialMediaAnalytics[]>(initialAnalytics);
    const [ideaToImplement, setIdeaToImplement] = useState<VideoSuggestion | null>(null);

    const handleGeneratePlan = async (topic: string) => {
        if (!aiClient) return;
        const prompt = `You are a social media manager for a school. Create a content plan for an upcoming event: "${topic}".
        Provide a JSON array of objects, where each object has "platform" (Instagram, Facebook, or X) and "taskDescription" (a specific action for that platform).`;
        try {
            const response = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            const tasks = extractAndParseJson<PlatformTask[]>(textFromGemini(response));
            if (tasks && Array.isArray(tasks)) {
                setPlatformTasks(tasks);
                addToast('Content plan generated!', 'success');
            } else {
                throw new Error('Invalid JSON format from AI.');
            }
        } catch (error) {
            addToast('Failed to generate content plan.', 'error');
        }
    };

    const handleGenerateIdeas = async () => {
        if (!aiClient) return;
        const prompt = `You are a creative strategist for a school's social media. Suggest 3 fresh and engaging short-form video ideas (for TikTok/Reels) that are relevant to school life.
        Provide a JSON array of objects, each with "trend" (the current trend it's based on), "idea" (the specific video concept for the school), and "example" (a brief script or shot list).`;
        try {
            const response = await aiClient.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            const suggestions = extractAndParseJson<VideoSuggestion[]>(textFromGemini(response));
            if (suggestions && Array.isArray(suggestions)) {
                setVideoSuggestions(suggestions);
                addToast('Video ideas generated!', 'success');
            } else {
                throw new Error('Invalid JSON format from AI.');
            }
        } catch (error) {
            addToast('Failed to generate video ideas.', 'error');
        }
    };

    const handleAnalyzePerformance = async () => {
        if (!aiClient || analyticsData.length === 0) return;
        const prompt = `Analyze the following social media performance data for a school. Identify key strengths, weaknesses, and provide 3 actionable recommendations.
        Data: ${JSON.stringify(analyticsData)}
        Provide a JSON object with "strengths" (array of strings), "weaknesses" (array of strings), and "recommendations" (array of strings).`;
        try {
            const response = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            const analysis = extractAndParseJson<PerformanceAnalysis>(textFromGemini(response));
            if (analysis) {
                setPerformanceAnalysis(analysis);
                addToast('Performance analysis complete!', 'success');
            } else {
                throw new Error('Invalid JSON format from AI.');
            }
        } catch (error) {
            addToast('Failed to analyze performance.', 'error');
        }
    };
    
    const handleGenerateAnalyticsData = async () => {
        addToast('Simulating new analytics data...', 'info');
        await new Promise(res => setTimeout(res, 500)); // Simulate async fetch
        setAnalyticsData([
            { platform: 'Instagram', followers: Math.floor(1250 + Math.random() * 100), engagementRate: 5.2 + (Math.random() - 0.5) },
            { platform: 'Facebook', followers: Math.floor(2300 + Math.random() * 200), engagementRate: 3.1 + (Math.random() - 0.5) },
            { platform: 'X', followers: Math.floor(850 + Math.random() * 50), engagementRate: 2.5 + (Math.random() - 0.5) },
        ]);
    };

    const handleImplementIdea = async (dueDate: string) => {
        if (!ideaToImplement) return;
        const socialMediaManager = users.find(u => u.role === 'Social Media Manager');
        if (!socialMediaManager) {
            addToast('Cannot create task: "Social Media Manager" role not found.', 'error');
            return;
        }
        const success = await onAddTask({
            title: `Video: ${ideaToImplement.idea}`,
            description: `Create a video based on the AI suggestion:\nTrend: ${ideaToImplement.trend}\nExample: ${ideaToImplement.example}`,
            due_date: dueDate,
            priority: TaskPriority.Medium,
            status: TaskStatus.ToDo,
            user_id: socialMediaManager.id,
        });
        if (success) {
            addToast('Task created for video idea!', 'success');
            setVideoSuggestions(prev => prev.filter(s => s.idea !== ideaToImplement.idea));
            setIdeaToImplement(null);
        } else {
            addToast('Failed to create task.', 'error');
        }
    };
    
    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">🚀 Social Media Hub</h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">AI-powered tools to manage and grow your school's online presence.</p>
            </div>
            <div className="flex flex-col lg:flex-row gap-6 min-h-[70vh]">
                <ContentPlannerWidget onGenerate={handleGeneratePlan} tasks={platformTasks} />
                <VideoTrendSuggesterWidget onGenerate={handleGenerateIdeas} suggestions={videoSuggestions} onImplement={setIdeaToImplement} />
                <PerformanceAnalyticsWidget 
                    analytics={analyticsData}
                    accounts={initialAccounts}
                    onAnalyze={handleAnalyzePerformance}
                    analysis={performanceAnalysis}
                    onSaveSocialLinks={onSaveSocialLinks}
                    onGenerateAnalyticsData={handleGenerateAnalyticsData}
                />
            </div>
            <ImplementIdeaModal 
                isOpen={!!ideaToImplement} 
                onClose={() => setIdeaToImplement(null)} 
                onSubmit={handleImplementIdea} 
                idea={ideaToImplement}
            />
        </div>
    );
};

export default SocialMediaHubView;
