

import React, { useState, useRef } from 'react';
// FIX: Import specific document types instead of the generic UPSSGPTResponse.
import type { SchoolSettings, CoverageDeviation, SchoolHealthReport, SchoolImprovementPlan, UPSSGPTResponse } from '../types';
import Spinner from './common/Spinner';
import { HeartIcon, EyeIcon, TrendingUpIcon, ChartBarIcon, WandIcon } from './common/icons';
import { getAIClient } from '../services/aiClient';
import { extractAndParseJson } from '../utils/json';
import { textFromAI } from '../utils/ai';

type AIViewTab = 'Health Check' | 'Foresight' | 'Improvement Plan' | 'Coverage Deviation';

// --- Tab Components ---

const HealthCheckTab: React.FC<{
    report: SchoolHealthReport | null;
    onGenerate: () => Promise<void>;
}> = ({ report, onGenerate }) => {
    const [isLoading, setIsLoading] = useState(false);
    const handleGenerate = async () => {
        setIsLoading(true);
        await onGenerate();
        setIsLoading(false);
    };
    
    const getScoreColor = (score: number) => {
        if (score > 85) return 'text-green-500';
        if (score > 65) return 'text-yellow-500';
        return 'text-red-500';
    }

    return (
         <div className="space-y-6">
            {!report && !isLoading && (
              <div className="text-center py-12">
                <p className="text-slate-600 dark:text-slate-300 mb-4">Generate a real-time health report based on the latest reports, tasks, and sentiment data.</p>
                <button onClick={handleGenerate} className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Generate Health Report</button>
              </div>
            )}
            
            {isLoading && (
                <div className="text-center py-12">
                    <Spinner size="lg" />
                    <p className="mt-4 text-slate-500">Analyzing data...</p>
                </div>
            )}

            {report && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="text-center">
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Overall Health Score</p>
                        <p className={`text-7xl font-bold ${getScoreColor(report.overall_score)}`}>{report.overall_score}</p>
                    </div>
                    <div className="flex-1 p-4 bg-blue-500/10 rounded-lg">
                        <h3 className="font-bold text-blue-800 dark:text-blue-300">AI Summary</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-200 mt-2">{report.summary}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.metrics.map(metric => (
                        <div key={metric.metric} className="p-4 bg-slate-500/10 rounded-lg">
                            <div className="flex justify-between items-center">
                                <h4 className="font-semibold text-slate-800 dark:text-white">{metric.metric}</h4>
                                <p className={`font-bold text-2xl ${getScoreColor(metric.score)}`}>{metric.score}</p>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{metric.summary}</p>
                        </div>
                    ))}
                </div>
                 <div className="text-center border-t border-slate-200/60 dark:border-slate-800/60 pt-4">
                    <button onClick={handleGenerate} disabled={isLoading} className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30">
                        Regenerate Report
                    </button>
                 </div>
              </div>
            )}
          </div>
    )
}

const ForesightTab: React.FC<{ onGenerate: (question: string) => Promise<UPSSGPTResponse | null>; addToast: (message: string, type?:'success'|'error'|'info') => void; }> = ({ onGenerate, addToast }) => {
    const [question, setQuestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<UPSSGPTResponse | null>(null);

    const handleGenerate = async () => {
        if (!question.trim()) {
            addToast('Please enter a question or scenario.', 'error');
            return;
        }
        setIsLoading(true);
        setResult(null);
        const res = await onGenerate(question);
        setResult(res);
        setIsLoading(false);
    }
    
    return (
        <div className="space-y-6">
            <h3 className="font-semibold text-lg">Predictive Analysis</h3>
            <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Ask a question about potential future scenarios, e.g., 'What are the biggest risks to student morale in the next month?' or 'Which team is most likely to face burnout?'"
                rows={4}
                className="w-full p-2 border rounded-md"
                disabled={isLoading}
            />
            <button onClick={handleGenerate} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg">
                {isLoading ? <Spinner size="sm"/> : 'Generate Foresight'}
            </button>
            
            {result && (
                <div className="mt-4 p-4 border rounded-lg bg-slate-100 dark:bg-slate-800 animate-fade-in">
                    <p className="font-semibold">Answer:</p>
                    <p>{result.answer}</p>
                    {result.alerts.length > 0 && <div className="mt-2"><p className="font-semibold">Alerts:</p><ul>{result.alerts.map((a, i) => <li key={i}>- {a}</li>)}</ul></div>}
                    {result.recommended_actions.length > 0 && <div className="mt-2"><p className="font-semibold">Recommended Actions:</p><ul>{result.recommended_actions.map((a, i) => <li key={i}>- {a}</li>)}</ul></div>}
                </div>
            )}
        </div>
    )
}

const ImprovementPlanTab: React.FC<{ plan: SchoolImprovementPlan | null; onGenerate: () => Promise<void>; }> = ({ plan, onGenerate }) => {
     const [isLoading, setIsLoading] = useState(false);
     const handleGenerate = async () => {
        setIsLoading(true);
        await onGenerate();
        setIsLoading(false);
    }
    
    return (
        <div className="space-y-6">
            <button onClick={handleGenerate} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                {isLoading ? <Spinner size="sm"/> : (plan ? 'Regenerate Plan' : 'Generate Improvement Plan')}
            </button>
            
            {plan && (
                <div className="space-y-4 animate-fade-in">
                    <div className="p-4 bg-blue-500/10 rounded-lg"><h3 className="font-bold">Executive Summary</h3><p>{plan.executive_summary}</p></div>
                    {plan.strategic_goals.map((goal, i) => (
                        <div key={i} className="p-4 border rounded-lg">
                            <h4 className="font-bold">{i+1}. {goal.goal}</h4>
                            <p className="text-sm font-semibold mt-2">Initiatives:</p>
                            <ul className="list-disc list-inside text-sm">{goal.initiatives.map((item, j) => <li key={j}>{item}</li>)}</ul>
                            <p className="text-sm font-semibold mt-2">KPI:</p>
                            <p className="text-sm">{goal.kpi}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const CoverageDeviationTab: React.FC<{ settings: SchoolSettings | null, onGenerate: () => Promise<void> }> = ({ settings, onGenerate }) => {
    const [isLoading, setIsLoading] = useState(false);
    const report = settings?.school_documents?.coverage_deviation_report;

    const handleGenerate = async () => {
        setIsLoading(true);
        await onGenerate();
        setIsLoading(false);
    };

    return (
        <div className="space-y-4">
             <button onClick={handleGenerate} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                {isLoading ? <Spinner size="sm"/> : 'Generate Deviation Report'}
            </button>
            {report ? (
                 <div className="overflow-x-auto">
                     <p className="text-xs text-slate-500 mb-2">Generated at: {new Date(report.generated_at).toLocaleString()}</p>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-800">
                            <tr>
                                <th className="p-2 text-left">Assignment</th>
                                <th className="p-2 text-left">Week</th>
                                <th className="p-2 text-left">Status</th>
                                <th className="p-2 text-left">Justification</th>
                            </tr>
                        </thead>
                        <tbody>
                        {report.report.map((item, index) => (
                            <tr key={index} className="border-t">
                                <td className="p-2">{item.teacherName} - {item.teachingAssignment}</td>
                                <td className="p-2">{item.week}</td>
                                <td className="p-2">{item.status}</td>
                                <td className="p-2 text-xs">{item.justification}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                 </div>
            ) : (
                <p className="text-slate-500 text-center py-8">Generate a report to see curriculum deviations.</p>
            )}
        </div>
    )
}

// --- Main View ---

interface AIStrategicCenterViewProps {
  healthReport: SchoolHealthReport | null;
  onGenerateHealthReport: () => Promise<void>;
  onGenerateForesight: (question: string) => Promise<UPSSGPTResponse | null>;
  improvementPlan: SchoolImprovementPlan | null;
  onGenerateImprovementPlan: () => Promise<void>;
  addToast: (message: string, type?:'success'|'error'|'info') => void;
  schoolSettings: SchoolSettings | null;
  onGenerateCoverageDeviationReport: () => Promise<void>;
}

const AIStrategicCenterView: React.FC<AIStrategicCenterViewProps> = (props) => {
    const [activeTab, setActiveTab] = useState<AIViewTab>('Health Check');
    const { onGenerateHealthReport, onGenerateForesight, onGenerateImprovementPlan, onGenerateCoverageDeviationReport } = props;

    const tabs: { name: AIViewTab, icon: React.FC<any> }[] = [
        { name: 'Health Check', icon: HeartIcon },
        { name: 'Foresight', icon: EyeIcon },
        { name: 'Improvement Plan', icon: TrendingUpIcon },
        { name: 'Coverage Deviation', icon: ChartBarIcon },
    ];
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">AI Strategic Center</h1>
                <p className="text-slate-600 mt-1">High-level analysis and planning tools powered by UPSS-GPT.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
                <nav className="flex-shrink-0 md:w-48">
                    <ul className="space-y-1">
                        {tabs.map(tab => (
                            <li key={tab.name}>
                                <button
                                    onClick={() => setActiveTab(tab.name)}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex items-center gap-3 ${
                                        activeTab === tab.name
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <tab.icon className="w-5 h-5" />
                                    {tab.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
                <main className="flex-1 rounded-2xl border bg-white/60 p-6 min-h-[60vh]">
                     {activeTab === 'Health Check' && <HealthCheckTab report={props.healthReport} onGenerate={onGenerateHealthReport} />}
                     {activeTab === 'Foresight' && <ForesightTab onGenerate={onGenerateForesight} addToast={props.addToast} />}
                     {activeTab === 'Improvement Plan' && <ImprovementPlanTab plan={props.improvementPlan} onGenerate={onGenerateImprovementPlan} />}
                     {activeTab === 'Coverage Deviation' && <CoverageDeviationTab settings={props.schoolSettings} onGenerate={onGenerateCoverageDeviationReport} />}
                </main>
            </div>
        </div>
    );
}

export default AIStrategicCenterView;
