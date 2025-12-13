import React, { useState, useRef } from 'react';
import { getAIClient, getCurrentModel } from '../services/aiClient';
import Spinner from './common/Spinner';
import { ChartBarIcon, WandIcon } from './common/icons';
import { extractAndParseJson } from '../utils/json';
import { textFromAI } from '../utils/ai';

interface DataAnalysisViewProps {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const DataAnalysisView: React.FC<DataAnalysisViewProps> = ({ addToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    setFile(null);
    setFileContent('');
    setQuestion('');
    setAnalysisResult('');
    setSuggestedQuestions([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const generateSuggestions = async (csvContent: string) => {
    const aiClient = getAIClient();
    if (!aiClient) return;
    setIsSuggesting(true);
    try {
        const firstFewLines = csvContent.split('\n').slice(0, 5).join('\n');
        const prompt = `Based on the headers and first few rows of this CSV data, suggest 3 insightful questions a school administrator might ask. Return a JSON array of strings.
        
        CSV Preview:
        ${firstFewLines}`;

        const response = await aiClient.chat.completions.create({
            model: getCurrentModel(),
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
        });
        
        const suggestions = extractAndParseJson<string[]>(textFromAI(response));
        if (suggestions) {
            setSuggestedQuestions(suggestions);
        }

    } catch (err) {
        console.error("Failed to generate suggestions:", err);
    } finally {
        setIsSuggesting(false);
    }
};

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleClear();
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        addToast('Please upload a valid CSV file.', 'error');
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setFileContent(content);
        generateSuggestions(content);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleAnalyze = async () => {
    if (!fileContent || !question.trim()) {
      addToast('Please upload a file and ask a question.', 'error');
      return;
    }
    setIsLoading(true);
    setAnalysisResult('');
    try {
        const aiClient = getAIClient();
        if (!aiClient) throw new Error("AI Client not ready.");

        const prompt = `You are a helpful data analyst for a school administrator. Analyze the following CSV data to answer the user's question.
        Format your response in clear, readable Markdown. Provide a concise summary first, then a more detailed breakdown. Use tables or lists if they help clarify the data.

        CSV Data:
        ---
        ${fileContent}
        ---
        Question: "${question}"
        `;

        const stream = await aiClient.chat.completions.create({
            model: getCurrentModel(),
            messages: [{ role: 'user', content: prompt }],
            stream: true,
        });

        for await (const chunk of stream) {
            setAnalysisResult(prev => prev + (chunk.choices[0]?.delta?.content || ''));
        }

    } catch (err) {
      console.error(err);
      addToast('An error occurred during analysis.', 'error');
      setAnalysisResult("An error occurred. Please check the console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
            <ChartBarIcon className="w-8 h-8 mr-3 text-green-600"/>
            AI Data Analysis
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mt-1">Upload a CSV file and ask questions to get instant insights.</p>
      </div>
      
      <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 space-y-6">
        {/* Step 1: Upload */}
        <div>
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">1. Upload Data</h2>
                {file && <button onClick={handleClear} className="text-sm text-blue-600 hover:underline">Clear & Start Over</button>}
            </div>
            <div className="mt-2 flex items-center space-x-4">
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
            </div>
        </div>

        {/* Step 2: Question */}
        {fileContent && (
            <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-6 animate-fade-in">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">2. Ask a Question</h2>
                 <textarea
                    id="data-question"
                    rows={3}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., 'Which budget category is most over-spent?' or 'Summarize the main trends in student attendance.'"
                    className="mt-2 w-full p-2 bg-white/50 dark:bg-slate-800/50 border border-slate-300/60 dark:border-slate-700/60 rounded-md"
                 />
                 {isSuggesting ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner size="sm" /><span>Generating suggestions...</span></div>
                 ) : suggestedQuestions.length > 0 && (
                    <div className="mt-2 space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-2"><WandIcon className="w-4 h-4 text-purple-500" /> Suggested Questions:</p>
                        <div className="flex flex-wrap gap-2">
                            {suggestedQuestions.map((q, i) => (
                                <button key={i} onClick={() => setQuestion(q)} className="px-3 py-1 text-xs bg-purple-500/10 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-500/20">{q}</button>
                            ))}
                        </div>
                    </div>
                 )}
            </div>
        )}

        {/* Step 3: Analyze & Result */}
        {fileContent && (
            <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-6 animate-fade-in">
                 <h2 className="text-xl font-bold text-slate-800 dark:text-white">3. Get Insights</h2>
                 <button onClick={handleAnalyze} disabled={isLoading || !question.trim()} className="mt-2 w-full py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                    {isLoading ? 'Analyzing...' : 'Analyze Data'}
                </button>
                {(isLoading || analysisResult) && (
                    <div className="mt-4 p-4 bg-slate-500/5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 max-h-96 overflow-y-auto">
                         {isLoading && !analysisResult && <div className="flex justify-center items-center"><Spinner /></div>}
                         <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 font-sans">{analysisResult}</pre>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default DataAnalysisView;