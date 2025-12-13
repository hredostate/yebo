
import React, { useState } from 'react';
import type { LivingPolicySnippet, UserProfile } from '../types';
import { getAIClient, getCurrentModel } from '../services/aiClient';
import { textFromAI } from '../utils/ai';
import { WandIcon, BookOpenIcon } from './common/icons';
import Spinner from './common/Spinner';

interface LivingPolicyManagerProps {
  policySnippets: LivingPolicySnippet[];
  onAddSnippet: (content: string) => Promise<void>;
  userProfile: UserProfile;
  onSaveDocument: (content: string) => Promise<boolean>;
}

const LivingPolicyManager: React.FC<LivingPolicyManagerProps> = ({ policySnippets, onAddSnippet, userProfile, onSaveDocument }) => {
    const [input, setInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedDocument, setGeneratedDocument] = useState<string | null>(null);

    // New states for the query feature
    const [query, setQuery] = useState('');
    const [isQuerying, setIsQuerying] = useState(false);
    const [queryAnswer, setQueryAnswer] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!input.trim() || isSubmitting) return;
        setIsSubmitting(true);
        await onAddSnippet(input);
        setInput('');
        setIsSubmitting(false);
    };

    const handleEnhance = async () => {
        if (!input.trim() || isEnhancing) return;
        setIsEnhancing(true);
        try {
            const aiClient = getAIClient();
            if (!aiClient) throw new Error("AI Client not available.");
            const prompt = `You are an expert in writing clear, professional school policies. Enhance the following policy idea to be more formal and comprehensive.
            Original idea: "${input}"
            Enhanced version:`;
            const response = await aiClient.chat.completions.create({
                model: getCurrentModel(),
                messages: [{ role: 'user', content: prompt }],
            });
            setInput(textFromAI(response));
        } catch (error) {
            console.error("AI enhancement failed:", error);
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleGenerateDocument = async () => {
        if (policySnippets.length === 0 || isGenerating) return;
        setIsGenerating(true);
        setGeneratedDocument('');
        try {
            const aiClient = getAIClient();
            if (!aiClient) throw new Error("AI Client not available.");
            const snippetsText = policySnippets.map(s => `- ${s.content}`).join('\n');
            const prompt = `You are an expert in drafting official school documents.
            Based on the following collection of policy notes and ideas, synthesize them into a single, comprehensive, and well-structured 'Living Policy' document for a school.
            Organize the ideas into logical sections with clear headings (e.g., "Student Conduct," "Technology Usage," "Safety Protocols").
            Ensure the tone is professional, authoritative, and clear. Format the output using markdown for readability.

            Here are the policy notes:
            ${snippetsText}`;

            let fullResponse = '';
            const stream = await aiClient.chat.completions.create({
                model: getCurrentModel(),
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            });
            for await (const chunk of stream) {
                fullResponse += chunk.choices[0]?.delta?.content || '';
                setGeneratedDocument(fullResponse);
            }
            await onSaveDocument(fullResponse);
        } catch (error) {
            console.error("Failed to generate policy document:", error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleQueryPolicy = async () => {
        if (!query.trim() || isQuerying || policySnippets.length === 0) return;
        setIsQuerying(true);
        setQueryAnswer(''); // Use empty string for streaming
        try {
            const aiClient = getAIClient();
            if (!aiClient) throw new Error("AI Client not available.");
            
            const snippetsText = policySnippets.map(s => `- ${s.content}`).join('\n');
            const prompt = `You are an assistant for a school administrator. Your task is to answer questions based *only* on the provided school policy snippets. If the answer is not in the snippets, state that clearly. Do not invent information. Format your answer in simple markdown.

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
        } catch (error) {
            console.error("Policy query failed:", error);
            setQueryAnswer("Sorry, I encountered an error while trying to answer your question.");
        } finally {
            setIsQuerying(false);
        }
    };


    return (
        <div className="flex flex-col h-full animate-fade-in max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
                        <BookOpenIcon className="w-8 h-8 mr-3 text-blue-600"/>
                        Living Policy Knowledge Base
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Continuously feed the AI with policy info to build its knowledge.</p>
                </div>
                <button
                    onClick={handleGenerateDocument}
                    disabled={isGenerating || policySnippets.length === 0}
                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-400 flex items-center"
                >
                    {isGenerating ? <Spinner size="sm" /> : 'Generate & Save Document'}
                </button>
            </div>

            {/* Input area (Moved to Top) */}
            <div className="flex-shrink-0 mb-6 p-4 rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter a policy, rule, or procedure..."
                    rows={4}
                    className="w-full p-3 border rounded-xl shadow-sm bg-white/50 dark:bg-slate-800/50 border-slate-300/60 dark:border-slate-700/60 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSubmitting || isEnhancing}
                />
                <div className="mt-3 flex justify-end items-center space-x-3">
                    <button
                        onClick={handleEnhance}
                        title="Enhance with AI"
                        disabled={!input.trim() || isEnhancing || isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isEnhancing ? <Spinner size="sm" /> : <WandIcon className="w-5 h-5" />}
                        <span>Enhance with AI</span>
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!input.trim() || isSubmitting || isEnhancing}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400"
                    >
                        {isSubmitting && <Spinner size="sm" />}
                        <span>Add to Knowledge Base</span>
                    </button>
                </div>
            </div>

            <div className="flex-grow flex gap-6 min-h-0">
                {/* Main document view */}
                <div className="w-2/3 flex flex-col rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                    <h2 className="font-bold text-slate-800 dark:text-white text-lg mb-2">Generated Document</h2>
                    <div className="flex-grow overflow-y-auto pr-2 bg-slate-500/5 rounded-lg p-3">
                        {isGenerating && <div className="flex items-center justify-center h-full"><Spinner size="lg" /><p className="ml-4">Synthesizing document...</p></div>}
                        {!isGenerating && generatedDocument && <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{generatedDocument}</pre>}
                        {!isGenerating && !generatedDocument && <div className="text-center text-slate-500 pt-16">Click "Generate & Save Document" to create a compiled version of all snippets.</div>}
                    </div>
                </div>

                {/* Right Column: Query + Snippet Feed */}
                <div className="w-1/3 flex flex-col gap-4">
                    {/* Query Section */}
                     <div className="flex-shrink-0 rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                        <h2 className="font-bold text-slate-800 dark:text-white text-lg mb-2 flex items-center gap-2"><WandIcon className="w-5 h-5 text-purple-500" /> Query the Policy</h2>
                        <div className="space-y-2">
                            <textarea
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Ask a question about your policies..."
                                rows={2}
                                className="w-full p-2 border rounded-md bg-white/50 dark:bg-slate-800/50 border-slate-300/60 dark:border-slate-700/60"
                                disabled={isQuerying}
                            />
                            <button onClick={handleQueryPolicy} disabled={isQuerying || !query.trim() || policySnippets.length === 0} className="w-full py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-purple-400">
                                Ask AI
                            </button>
                        </div>
                        {(isQuerying || queryAnswer) && (
                            <div className="mt-4 border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
                                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-2">Answer:</h3>
                                <div className="p-2 bg-slate-500/5 rounded-md min-h-[50px]">
                                    {isQuerying && !queryAnswer && <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner size="sm" /><span>Thinking...</span></div>}
                                    {queryAnswer && <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 font-sans">{queryAnswer}</pre>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Snippet feed */}
                    <div className="flex-grow flex flex-col rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 min-h-0">
                        <h2 className="font-bold text-slate-800 dark:text-white text-lg mb-2 flex-shrink-0">Knowledge Feed</h2>
                        <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                            {policySnippets.length > 0 ? (
                                policySnippets.map(snippet => (
                                    <div key={snippet.id} className="p-3 bg-slate-500/10 rounded-lg">
                                        <p className="text-sm text-slate-700 dark:text-slate-200">{snippet.content}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-right">
                                            - {snippet.author?.name || 'User'} on {new Date(snippet.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-slate-500 pt-16">Add your first policy snippet above to build the knowledge base.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LivingPolicyManager;
