import React, { useState, useEffect } from 'react';
import type { LivingPolicySnippet, UserProfile, SchoolSettings } from '../types';
import { getAIClient, getCurrentModel, safeAIRequest } from '../services/aiClient';
import { WandIcon, BookOpenIcon } from './common/icons';
import Spinner from './common/Spinner';
import { requireSupabaseClient } from '../services/supabaseClient';

interface PolicyQueryViewProps {
    userProfile: UserProfile;
    schoolSettings: SchoolSettings | null;
}

const PolicyQueryView: React.FC<PolicyQueryViewProps> = ({ userProfile, schoolSettings }) => {
    const [policySnippets, setPolicySnippets] = useState<LivingPolicySnippet[]>([]);
    const [generatedDocument, setGeneratedDocument] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [isQuerying, setIsQuerying] = useState(false);
    const [queryAnswer, setQueryAnswer] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load policy snippets and generated document
    useEffect(() => {
        const loadPolicyData = async () => {
            setIsLoading(true);
            try {
                const supabase = requireSupabaseClient();
                // Load snippets
                const { data: snippets } = await supabase
                    .from('living_policy_snippets')
                    .select('*, author:user_profiles(name)')
                    .eq('school_id', userProfile.school_id)
                    .order('created_at', { ascending: false });

                if (snippets) {
                    setPolicySnippets(snippets);
                }

                // Load generated document from school_documents
                if (schoolSettings?.school_documents) {
                    const documents = schoolSettings.school_documents as any;
                    if (documents.living_policy_document) {
                        setGeneratedDocument(documents.living_policy_document);
                    }
                }
            } catch (error) {
                console.error('Failed to load policy data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadPolicyData();
    }, [userProfile.school_id, schoolSettings]);

    const handleQueryPolicy = async () => {
        if (!query.trim() || isQuerying || policySnippets.length === 0) return;
        setIsQuerying(true);
        setQueryAnswer('');
        try {
            const aiClient = getAIClient();
            if (!aiClient) {
                addToast('AI service not configured. Please check Settings > AI Configuration.', 'error');
                return;
            }
            
            console.log('[AI] PolicyQueryView: Starting query', { model: getCurrentModel() });

            const snippetsText = policySnippets.map(s => `- ${s.content}`).join('\n');
            const prompt = `You are an assistant for a school teacher. Your task is to answer questions based *only* on the provided school policy snippets. If the answer is not in the snippets, state that clearly. Do not invent information. Format your answer in simple markdown.

            Policy Snippets:
            ---
            ${snippetsText}
            ---

            Question: "${query}"

            Answer:`;

            const stream = await aiClient.chat.completions.create({
                model: getCurrentModel(),
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            });

            for await (const chunk of stream) {
                setQueryAnswer(prev => (prev || '') + (chunk.choices[0]?.delta?.content || ''));
            }
            
            console.log('[AI] PolicyQueryView: Query completed', { success: true });
        } catch (error: any) {
            console.error('[AI] PolicyQueryView: Query failed', { error: error.message });
            if (error?.status === 429 || error?.message?.includes('rate limit')) {
                addToast('AI rate limit reached. Please try again in a moment.', 'error');
            } else if (error?.status === 401) {
                addToast('AI authentication failed. Please check your API key.', 'error');
            } else {
                addToast('Failed to process query. Please try again.', 'error');
            }
            setQueryAnswer("Sorry, I encountered an error while trying to answer your question.");
        } finally {
            setIsQuerying(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Spinner size="lg" />
                <p className="ml-4 text-slate-600 dark:text-slate-300">Loading policy documents...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in max-w-7xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
                    <BookOpenIcon className="w-8 h-8 mr-3 text-blue-600" />
                    School Policy Documents
                </h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">
                    Read-only access to school policies. Use the AI assistant to ask questions about policies.
                </p>
            </div>

            <div className="flex-grow flex gap-6 min-h-0">
                {/* Main document view */}
                <div className="w-2/3 flex flex-col rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                    <h2 className="font-bold text-slate-800 dark:text-white text-xl mb-4">
                        Living Policy Document
                    </h2>
                    <div className="flex-grow overflow-y-auto pr-2 bg-slate-500/5 rounded-lg p-4">
                        {generatedDocument ? (
                            <div className="prose prose-slate dark:prose-invert max-w-none">
                                <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 font-sans">
                                    {generatedDocument}
                                </pre>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 pt-16">
                                <BookOpenIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                                <p>No policy document has been generated yet.</p>
                                <p className="text-sm mt-2">Contact your administrator to generate the living policy document.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Query + Snippet Feed */}
                <div className="w-1/3 flex flex-col gap-4">
                    {/* Query Section */}
                    <div className="flex-shrink-0 rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                        <h2 className="font-bold text-slate-800 dark:text-white text-lg mb-3 flex items-center gap-2">
                            <WandIcon className="w-5 h-5 text-purple-500" />
                            Ask AI About Policies
                        </h2>
                        <div className="space-y-3">
                            <textarea
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Ask a question about school policies..."
                                rows={3}
                                className="w-full p-3 border rounded-lg bg-white/50 dark:bg-slate-800/50 border-slate-300/60 dark:border-slate-700/60 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                disabled={isQuerying}
                            />
                            <button
                                onClick={handleQueryPolicy}
                                disabled={isQuerying || !query.trim() || policySnippets.length === 0}
                                className="w-full py-2.5 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {isQuerying ? (
                                    <>
                                        <Spinner size="sm" />
                                        <span>Thinking...</span>
                                    </>
                                ) : (
                                    <>
                                        <WandIcon className="w-5 h-5" />
                                        <span>Ask AI</span>
                                    </>
                                )}
                            </button>
                        </div>
                        {(isQuerying || queryAnswer) && (
                            <div className="mt-4 border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
                                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-2">
                                    Answer:
                                </h3>
                                <div className="p-3 bg-slate-500/10 rounded-lg min-h-[80px]">
                                    {isQuerying && !queryAnswer && (
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <Spinner size="sm" />
                                            <span>Analyzing policies...</span>
                                        </div>
                                    )}
                                    {queryAnswer && (
                                        <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                                            <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 font-sans">
                                                {queryAnswer}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Snippet feed */}
                    <div className="flex-grow flex flex-col rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 min-h-0">
                        <h2 className="font-bold text-slate-800 dark:text-white text-lg mb-3 flex-shrink-0">
                            Policy Snippets
                        </h2>
                        <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                            {policySnippets.length > 0 ? (
                                policySnippets.map(snippet => (
                                    <div
                                        key={snippet.id}
                                        className="p-3 bg-slate-500/10 rounded-lg border border-slate-200/40 dark:border-slate-700/40"
                                    >
                                        <p className="text-sm text-slate-700 dark:text-slate-200">
                                            {snippet.content}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-right">
                                            — {snippet.author?.name || 'Admin'} on{' '}
                                            {new Date(snippet.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-slate-500 pt-16">
                                    <p>No policy snippets available yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PolicyQueryView;
