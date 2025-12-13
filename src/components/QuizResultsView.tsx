import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { getAIClient, getCurrentModel } from '../services/aiClient';
import type { QuizWithQuestions, DetailedQuizResponse } from '../types';
import Spinner from './common/Spinner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { DownloadIcon, WandIcon } from './common/icons';
import { exportToCsv } from '../utils/export';
import { textFromAI } from '../utils/ai';

interface QuizResultsViewProps {
  quiz: QuizWithQuestions;
  onBack: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

const QuestionResultCard: React.FC<{ questionResult: any, onSummarize: (question: any) => void, summary?: string, isSummarizing?: boolean }> = ({ questionResult, onSummarize, summary, isSummarizing }) => {
    const { question_text, question_type, results } = questionResult;

    const renderContent = () => {
        switch(question_type) {
            case 'multiple_choice':
            case 'true_false':
                return (
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={results} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="option_text" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" name="Responses">
                                {results.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'ranking':
                const rankingData = Object.entries(results.distribution || {}).map(([key, value]) => ({ name: `${key} ★`, count: value }));
                return (
                    <div>
                        <p className="text-center font-semibold">Average Rating: <span className="text-xl">{Number(results.average).toFixed(2)}</span></p>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={rankingData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false}/>
                                <Tooltip />
                                <Bar dataKey="count" fill="#ffc658" name="Responses"/>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                );
            case 'short_answer':
                return (
                    <>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 border rounded-md p-2 bg-slate-500/5">
                            {(results && results.length > 0) ? results.map((answer: string, index: number) => (
                                <p key={index} className="text-sm border-b pb-1">"{answer}"</p>
                            )) : <p className="text-sm text-slate-500">No text answers submitted.</p>}
                        </div>
                        {summary && <div className="mt-2 p-2 bg-purple-500/10 rounded-md text-sm"><pre className="whitespace-pre-wrap font-sans">{summary}</pre></div>}
                        {(results && results.length > 0 && !summary) && (
                            <button onClick={() => onSummarize(questionResult)} disabled={isSummarizing} className="mt-2 text-sm flex items-center gap-2 px-3 py-1 bg-purple-500/20 rounded-md text-purple-700 hover:bg-purple-500/30">
                                {isSummarizing ? <Spinner size="sm" /> : <WandIcon className="w-4 h-4" />}
                                {isSummarizing ? 'Summarizing...' : 'Summarize with AI'}
                            </button>
                        )}
                    </>
                );
            default:
                return <p>Unsupported question type.</p>;
        }
    }

    return (
        <div className="rounded-2xl border bg-white/60 p-4">
            <h3 className="font-bold">{question_text}</h3>
            <div className="mt-4">
                {renderContent()}
            </div>
        </div>
    );
};


const QuizResultsView: React.FC<QuizResultsViewProps> = ({ quiz, onBack, addToast }) => {
    const [results, setResults] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [summarizingQuestionId, setSummarizingQuestionId] = useState<number | null>(null);
    const [summaries, setSummaries] = useState<Record<number, string>>({});
    const [isExporting, setIsExporting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

    useEffect(() => {
        const fetchResults = async () => {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_quiz_results', { p_quiz_id: quiz.id });
            if (error) {
                setError(error.message);
            } else {
                setResults(data);
            }
            setLoading(false);
        };
        fetchResults();
    }, [quiz.id]);

    const handleSummarizeShortAnswers = async (question: any) => {
        if (!question.results || question.results.length === 0) return;
        setSummarizingQuestionId(question.question_id);
        try {
            const aiClient = getAIClient();
            if (!aiClient) throw new Error("AI client not ready");
            const prompt = `Please summarize the key themes and overall sentiment from the following list of short answer responses:\n\n${question.results.join('\n- ')}`;
            const response = await aiClient.chat.completions.create({
                model: getCurrentModel(),
                messages: [{ role: 'user', content: prompt }],
            });
            setSummaries(prev => ({ ...prev, [question.question_id]: textFromAI(response) }));
        } catch (e) {
            console.error(e);
            setSummaries(prev => ({ ...prev, [question.question_id]: "Failed to generate summary." }));
        } finally {
            setSummarizingQuestionId(null);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        const { data, error } = await supabase.rpc('get_detailed_quiz_responses', { p_quiz_id: quiz.id });
        if (error) {
            console.error("Export error:", error.message);
            addToast(`Failed to export results: ${error.message}`, 'error');
        } else if (data && data.length > 0) {
            exportToCsv(data, `${quiz.title.replace(/ /g, '_')}_results.csv`);
            addToast('Results exported successfully!', 'success');
        } else {
            addToast('No results to export.', 'info');
        }
        setIsExporting(false);
    };

    const handleAnalyzeResults = async () => {
        setIsAnalyzing(true);
        setAiAnalysis('');
        try {
            const { data: detailedResults, error } = await supabase.rpc('get_detailed_quiz_responses', { p_quiz_id: quiz.id });
            if (error || !detailedResults) {
                throw new Error(error?.message || "Could not fetch detailed results for analysis.");
            }

            const aiClient = getAIClient();
            if (!aiClient) throw new Error("AI client not ready.");
            
            const promptContext = `
                Quiz Title: ${quiz.title}
                Quiz Description: ${quiz.description}
                Number of Questions: ${quiz.questions.length}
                
                Here are the detailed, per-user responses:
                ${JSON.stringify(detailedResults, null, 2)}
            `;

            const prompt = `You are a helpful data analyst for a school administrator.
            Analyze the provided quiz results and generate a summary.
            Your analysis should include:
            1. An overall summary of participation and general performance.
            2. Identification of any questions that were commonly answered incorrectly or showed significant disagreement.
            3. Key themes or insights from any open-ended (short answer) questions.
            4. Actionable recommendations for the school based on these results.
            
            Format your response in clear, readable Markdown.
            
            Context:
            ${promptContext}
            `;
            
            const stream = await aiClient.chat.completions.create({
                model: getCurrentModel(),
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            });
            for await (const chunk of stream) {
                setAiAnalysis(prev => (prev || '') + (chunk.choices[0]?.delta?.content || ''));
            }

        } catch (err: any) {
            setAiAnalysis("An error occurred during AI analysis: " + err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    if (error) {
        return <div className="text-red-500">Error fetching results: {error}</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <button onClick={onBack} className="text-sm text-blue-600 mb-2">&larr; Back to Quiz Manager</button>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold">{quiz.title} - Results</h1>
                        <p className="text-slate-600 mt-1">{quiz.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md text-sm font-semibold">
                            {isExporting ? <Spinner size="sm" /> : <DownloadIcon className="w-4 h-4"/>}
                            Export
                        </button>
                        <button onClick={handleAnalyzeResults} disabled={isAnalyzing} className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md text-sm font-semibold">
                            {isAnalyzing ? <Spinner size="sm" /> : <WandIcon className="w-4 h-4"/>}
                            Analyze with AI
                        </button>
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                {results && results.map(res => (
                    <QuestionResultCard 
                        key={res.question_id}
                        questionResult={res}
                        onSummarize={handleSummarizeShortAnswers}
                        summary={summaries[res.question_id]}
                        isSummarizing={summarizingQuestionId === res.question_id}
                    />
                ))}
            </div>

            {(isAnalyzing || aiAnalysis) && (
                <div className="rounded-2xl border bg-white/60 p-4">
                    <h2 className="font-bold text-lg mb-2 flex items-center gap-2"><WandIcon className="w-5 h-5 text-purple-500"/> AI Analysis & Summary</h2>
                     <div className="mt-4 p-4 bg-slate-500/5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 max-h-96 overflow-y-auto">
                         {isAnalyzing && !aiAnalysis && <div className="flex justify-center items-center"><Spinner /></div>}
                         <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 font-sans">{aiAnalysis}</pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuizResultsView;