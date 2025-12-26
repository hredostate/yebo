
import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import { getAIClient, getCurrentModel, safeAIRequest } from '../services/aiClient';
import type { SurveyWithQuestions, DetailedSurveyResponse } from '../types';
import Spinner from './common/Spinner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { DownloadIcon, WandIcon } from './common/icons';
import { exportToCsv } from '../utils/export';
import { textFromAI } from '../utils/ai';
import type { ScoreEntry, AttendanceRecord, ReportRecord } from '../types';

interface SurveyResultsViewProps {
  survey: SurveyWithQuestions;
  onBack: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  scoreEntries?: ScoreEntry[];
  attendanceRecords?: AttendanceRecord[];
  reports?: ReportRecord[];
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


const SurveyResultsView: React.FC<SurveyResultsViewProps> = ({ survey, onBack, addToast, scoreEntries = [], attendanceRecords = [], reports = [] }) => {
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
            const supabase = requireSupabaseClient();
            setLoading(true);
            // Note: DB function is still called get_quiz_results
            const { data, error } = await supabase.rpc('get_quiz_results', { p_quiz_id: survey.id });
            if (error) {
                setError(error.message);
            } else {
                setResults(data);
            }
            setLoading(false);
        };
        fetchResults();
    }, [survey.id]);

    const handleSummarizeShortAnswers = async (question: any) => {
        if (!question.results || question.results.length === 0) return;
        setSummarizingQuestionId(question.question_id);
        try {
            const aiClient = getAIClient();
            if (!aiClient) {
                addToast('AI service not configured. Please check Settings > AI Configuration.', 'error');
                return;
            }
            
            console.log('[AI] SurveyResultsView: Starting summary', { model: getCurrentModel() });
            
            const prompt = `Please summarize the key themes and overall sentiment from the following list of short answer responses:\n\n${question.results.join('\n- ')}`;
            const response = await safeAIRequest(
                () => aiClient.chat.completions.create({
                    model: getCurrentModel(),
                    messages: [{ role: 'user', content: prompt }],
                }),
                { maxRetries: 2 }
            );
            
            console.log('[AI] SurveyResultsView: Summary completed', { success: true });
            setSummaries(prev => ({ ...prev, [question.question_id]: textFromAI(response) }));
        } catch (e: any) {
            console.error('[AI] SurveyResultsView: Summary failed', { error: e.message });
            if (e?.status === 429 || e?.message?.includes('rate limit')) {
                addToast('AI rate limit reached. Please try again in a moment.', 'error');
            } else if (e?.status === 401) {
                addToast('AI authentication failed. Please check your API key.', 'error');
            } else {
                addToast('Failed to generate summary. Please try again.', 'error');
            }
            setSummaries(prev => ({ ...prev, [question.question_id]: "Failed to generate summary." }));
        } finally {
            setSummarizingQuestionId(null);
        }
    };

    const handleExport = async () => {
        const supabase = requireSupabaseClient();
        setIsExporting(true);
        const { data, error } = await supabase.rpc('get_detailed_quiz_responses', { p_quiz_id: survey.id });
        if (error) {
            console.error("Export error:", error.message);
            addToast(`Failed to export results: ${error.message}`, 'error');
        } else if (data && data.length > 0) {
            exportToCsv(data, `${survey.title.replace(/ /g, '_')}_results.csv`);
            addToast('Results exported successfully!', 'success');
        } else {
            addToast('No results to export.', 'info');
        }
        setIsExporting(false);
    };

    const handleAnalyzeResults = async () => {
        const supabase = requireSupabaseClient();
        setIsAnalyzing(true);
        setAiAnalysis('');
        try {
            const { data: detailedResults, error } = await supabase.rpc('get_detailed_quiz_responses', { p_quiz_id: survey.id });
            if (error || !detailedResults) {
                throw new Error(error?.message || "Could not fetch detailed results for analysis.");
            }

            const aiClient = getAIClient();
            if (!aiClient) throw new Error("AI client not ready.");
            
            // NEW: Fetch additional context for respondents if data is available
            const respondentIds: number[] = [...new Set(detailedResults.map((r: any) => Number(r.student_id)).filter(id => !isNaN(id)))];
            
            let respondentProfiles: any[] = [];
            if (respondentIds.length > 0 && scoreEntries.length > 0) {
                // Get academic data for respondents
                const respondentScores = scoreEntries.filter(s => respondentIds.includes(s.student_id));
                const respondentAttendance = attendanceRecords.filter(a => respondentIds.includes(a.student_id));
                const respondentBehavior = reports.filter(r => 
                    r.involved_students?.some(id => respondentIds.includes(id))
                );
                
                // Calculate correlations
                respondentProfiles = respondentIds.map(id => {
                    const scores = respondentScores.filter(s => s.student_id === id);
                    const avgScore = scores.length > 0 
                        ? scores.reduce((sum, s) => sum + s.total_score, 0) / scores.length 
                        : null;
                    const attendance = respondentAttendance.filter(a => a.student_id === id);
                    const attendanceRate = attendance.length > 0
                        ? (attendance.filter(a => a.status === 'Present').length / attendance.length) * 100
                        : null;
                    const behaviorReports = respondentBehavior.filter(r => 
                        r.involved_students?.includes(id)
                    );
                    
                    return {
                        studentId: id,
                        averageAcademicScore: avgScore,
                        attendanceRate: attendanceRate,
                        negativeBehaviorCount: behaviorReports.filter(r => r.analysis?.sentiment === 'Negative').length,
                        positiveBehaviorCount: behaviorReports.filter(r => r.analysis?.sentiment === 'Positive').length
                    };
                });
            }
            
            const promptContext = `
                Survey Title: ${survey.title}
                Description: ${survey.description}
                Number of Questions: ${survey.questions.length}
                
                Survey Responses: ${JSON.stringify(detailedResults, null, 2)}
                ${respondentProfiles.length > 0 ? `
                
                Respondent Academic/Behavioral Profiles: ${JSON.stringify(respondentProfiles, null, 2)}
                ` : ''}
            `;

            const prompt = `You are a helpful data analyst for a school administrator.
            Analyze the provided survey results${respondentProfiles.length > 0 ? ' WITH correlation to student performance data' : ''} and generate a summary.
            
            Your analysis should include:
            1. Overall participation and response summary
            2. Key trends in the responses
            3. Key themes or insights from any open-ended (short answer) questions
            ${respondentProfiles.length > 0 ? `4. **Correlation Analysis**
               - Do students with lower academic scores respond differently?
               - Is there a pattern between attendance rate and certain responses?
               - Do students with behavior issues express different sentiments?
            5. Identify any concerning patterns (e.g., struggling students reporting stress)
            6. Actionable recommendations based on correlations found` : '4. Actionable recommendations for the school based on this feedback'}
            
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
                <button onClick={onBack} className="text-sm text-blue-600 mb-2">&larr; Back to Survey Manager</button>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold">{survey.title} - Results</h1>
                        <p className="text-slate-600 mt-1">{survey.description}</p>
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

export default SurveyResultsView;
