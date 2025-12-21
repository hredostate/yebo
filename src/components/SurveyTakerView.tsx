
import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import { aiClient } from '../services/aiClient';
import type { SurveyWithQuestions, MultipleChoiceOption } from '../types';
import Spinner from './common/Spinner';
import { StarIcon, SparklesIcon } from './common/icons';

interface SurveyTakerViewProps {
    survey: SurveyWithQuestions;
    onBack: () => void;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    onSubmitSurvey?: (answers: any[]) => Promise<boolean>;
}

type Answer = {
    question_id: number;
    answer_text?: string;
    selected_option?: number;
    ranking_value?: number;
};

const SurveyTakerView: React.FC<SurveyTakerViewProps> = ({ survey, onBack, addToast, onSubmitSurvey }) => {
    const [answers, setAnswers] = useState<Record<number, Answer>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [optionCounts, setOptionCounts] = useState<Record<string, number>>({});
    const [isLoadingCounts, setIsLoadingCounts] = useState(true);

    useEffect(() => {
        const fetchOptionCounts = async () => {
            const supabase = requireSupabaseClient();
            // Fetch all responses for this survey to calculate current quotas
            const { data, error } = await supabase
                .from('quiz_responses')
                .select('question_id, selected_option_index')
                .eq('quiz_id', survey.id);
            
            if (data) {
                const counts: Record<string, number> = {};
                data.forEach((r: any) => {
                    if (r.selected_option_index !== null && r.question_id) {
                        const key = `${r.question_id}-${r.selected_option_index}`;
                        counts[key] = (counts[key] || 0) + 1;
                    }
                });
                setOptionCounts(counts);
            }
            setIsLoadingCounts(false);
        };
        
        fetchOptionCounts();
    }, [survey.id]);

    const handleAnswerChange = (questionId: number, answer: Partial<Answer>) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: {
                ...prev[questionId],
                ...answer,
                question_id: questionId,
            }
        }));
    };
    
    const generateCreativeFeedback = async () => {
        if (!aiClient) return;

        setIsGeneratingFeedback(true);
        try {
            const answerDetails = survey.questions.map(q => {
                const answer = answers[q.id!];
                let answerText = '';
                if(q.question_type === 'multiple_choice') {
                    answerText = (q.options as MultipleChoiceOption[])[answer.selected_option!].text;
                } else if (q.question_type === 'ranking') {
                    answerText = `${answer.ranking_value} stars`;
                } else {
                    answerText = answer.answer_text!;
                }
                return `- For "${q.question_text}", you answered: "${answerText}"`;
            }).join('\n');

            const prompt = `A user has just completed the survey "${survey.title}". Here are their answers:\n${answerDetails}\n\nProvide a short, positive confirmation message thanking them for their feedback. Keep it under 40 words.`;
            
            const response = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: "You are a polite school administrator."
                }
            });

            setFeedback(response.text);

        } catch (e) {
            console.error("Feedback generation failed:", e);
            // Don't bother the user with this error, just skip the feedback.
            onBack();
        } finally {
            setIsGeneratingFeedback(false);
        }
    };


    const handleSubmit = async () => {
            const supabase = requireSupabaseClient();
        const unansweredQuestions = survey.questions.filter(q => !answers[q.id!]);
        if (unansweredQuestions.length > 0) {
            addToast(`Please answer all questions. Question ${unansweredQuestions[0].position + 1} is unanswered.`, 'error');
            return;
        }

        setIsSubmitting(true);
        const payload = Object.values(answers);
        let success = false;

        if (onSubmitSurvey) {
            success = await onSubmitSurvey(payload);
        } else {
            // Note: Backend function 'submit_quiz_answers' is still used as we kept the DB table names for now.
            const { error } = await supabase.rpc('submit_quiz_answers', { p_answers: payload });
            if (error) {
                addToast(`Error submitting survey: ${error.message}`, 'error');
            } else {
                addToast('Survey submitted successfully!', 'success');
                success = true;
            }
        }
        
        setIsSubmitting(false);

        if (success) {
            await generateCreativeFeedback();
        }
    };
    
    const StarRatingInput: React.FC<{ questionId: number }> = ({ questionId }) => {
        const [hover, setHover] = useState(0);
        const currentRating = answers[questionId]?.ranking_value || 0;
        return (
            <div className="flex space-x-1">
                {[...Array(5)].map((_, index) => {
                    const ratingValue = index + 1;
                    return (
                        <button
                            type="button"
                            key={ratingValue}
                            className="text-3xl cursor-pointer"
                            onClick={() => handleAnswerChange(questionId, { ranking_value: ratingValue })}
                            onMouseEnter={() => setHover(ratingValue)}
                            onMouseLeave={() => setHover(0)}
                        >
                            <span className={ratingValue <= (hover || currentRating) ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'}><StarIcon className="w-8 h-8"/></span>
                        </button>
                    );
                })}
            </div>
        );
    }
    
    // Render feedback modal
    if (isGeneratingFeedback || feedback) {
        return (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
                <div className="rounded-2xl border bg-white/80 p-6 text-center max-w-md w-full">
                    {isGeneratingFeedback ? (
                        <>
                            <Spinner size="lg"/>
                            <p className="mt-4 text-slate-600">Saving your responses...</p>
                        </>
                    ) : (
                        <>
                            <SparklesIcon className="w-12 h-12 text-green-500 mx-auto mb-4"/>
                            <h2 className="text-xl font-bold">Thank you!</h2>
                            <p className="my-4 text-slate-700">{feedback}</p>
                            <button onClick={onBack} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Done</button>
                        </>
                    )}
                </div>
            </div>
        )
    }

    if (isLoadingCounts) {
        return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <button onClick={onBack} className="text-sm text-blue-600 mb-2">&larr; Back to Surveys</button>
                <h1 className="text-3xl font-bold">{survey.title}</h1>
                <p className="text-slate-600 mt-1">{survey.description}</p>
            </div>

            <div className="space-y-6">
                {survey.questions.sort((a, b) => a.position - b.position).map((q, index) => (
                    <div key={q.id} className="p-4 rounded-xl border bg-white/60">
                        <p className="font-semibold">{index + 1}. {q.question_text}</p>
                        <div className="mt-4">
                            {q.question_type === 'multiple_choice' && (
                                <div className="space-y-2">
                                    {(q.options as MultipleChoiceOption[])?.map((opt, optIndex) => {
                                        const currentCount = optionCounts[`${q.id}-${optIndex}`] || 0;
                                        const limit = opt.quota;
                                        const isFull = limit !== null && limit !== undefined && currentCount >= limit;
                                        
                                        // Check if user has already selected this option (allows re-selecting if changing mind)
                                        const isSelected = answers[q.id!]?.selected_option === optIndex;

                                        return (
                                            <label key={optIndex} className={`flex items-center p-2 rounded-lg border border-transparent transition-colors ${isFull && !isSelected ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : 'bg-slate-500/5 hover:bg-slate-500/10 cursor-pointer'}`}>
                                                <input
                                                    type="radio"
                                                    name={`q-${q.id}`}
                                                    onChange={() => handleAnswerChange(q.id!, { selected_option: optIndex })}
                                                    className="h-4 w-4 text-blue-600 border-slate-300"
                                                    disabled={isFull && !isSelected}
                                                    checked={isSelected}
                                                />
                                                <div className="ml-3 flex-grow flex justify-between items-center">
                                                    <span>{opt.text}</span>
                                                    {isFull && !isSelected && (
                                                        <span className="text-xs font-bold text-red-500 uppercase ml-2">(Full)</span>
                                                    )}
                                                    {limit !== null && limit !== undefined && !isFull && (
                                                        <span className="text-xs text-slate-400">{limit - currentCount} spots left</span>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                            {q.question_type === 'short_answer' && (
                                <textarea
                                    rows={4}
                                    className="w-full p-2 border rounded-md"
                                    onChange={e => handleAnswerChange(q.id!, { answer_text: e.target.value })}
                                />
                            )}
                            {q.question_type === 'true_false' && (
                                <div className="flex gap-4">
                                    <label className="flex items-center p-2 rounded-lg bg-slate-500/5 hover:bg-slate-500/10 cursor-pointer">
                                        <input type="radio" name={`q-${q.id}`} onChange={() => handleAnswerChange(q.id!, { answer_text: 'True', selected_option: 0 })} />
                                        <span className="ml-2">True</span>
                                    </label>
                                    <label className="flex items-center p-2 rounded-lg bg-slate-500/5 hover:bg-slate-500/10 cursor-pointer">
                                        <input type="radio" name={`q-${q.id}`} onChange={() => handleAnswerChange(q.id!, { answer_text: 'False', selected_option: 1 })} />
                                        <span className="ml-2">False</span>
                                    </label>
                                </div>
                            )}
                            {q.question_type === 'ranking' && <StarRatingInput questionId={q.id!} />}
                        </div>
                    </div>
                ))}
            </div>

            <button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-400 flex items-center justify-center"
            >
                {isSubmitting ? <Spinner /> : 'Submit Survey'}
            </button>
        </div>
    );
};

export default SurveyTakerView;
