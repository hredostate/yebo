

import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { StudentProfile, QuizWithQuestions } from '../types';
import Spinner from './common/Spinner';
import QuizListView from './QuizListView';
import QuizTakerView from './QuizTakerView';

interface StudentQuizzesViewProps {
    studentProfile: StudentProfile;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const StudentQuizzesView: React.FC<StudentQuizzesViewProps> = ({ studentProfile, addToast }) => {
    const [quizzes, setQuizzes] = useState<QuizWithQuestions[]>([]);
    const [takenQuizIds, setTakenQuizIds] = useState<Set<number>>(new Set());
    const [selectedQuiz, setSelectedQuiz] = useState<QuizWithQuestions | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            
            try {
                const supabase = requireSupabaseClient();
                // 1. Fetch all quizzes (filtering by audience would ideally happen server-side or here)
                // For now fetching all for simplicity
                const { data: allQuizzes, error: quizzesError } = await supabase
                    .from('quizzes')
                    .select('*, questions:quiz_questions(*)');

                if (quizzesError) throw quizzesError;

                // 2. Filter quizzes for this student (audience check logic would go here)
                // For MVP, we show all. In production, implement audience matching based on student's class/role.
                setQuizzes(allQuizzes || []);

                // 3. Fetch taken quizzes
                const { data: responses, error: responsesError } = await supabase
                    .from('quiz_responses')
                    .select('quiz_id')
                    .eq('user_id', studentProfile.id); // Assuming user_id is the auth UUID
                
                if (responsesError) throw responsesError;
                
                const takenIds = new Set<number>((responses || []).map((r: any) => r.quiz_id));
                setTakenQuizIds(takenIds);

            } catch (error: any) {
                console.error("Error loading quizzes:", error);
                addToast("Failed to load quizzes.", "error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [studentProfile, addToast]);
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }
    
    if (selectedQuiz) {
        return <QuizTakerView 
            quiz={selectedQuiz}
            onBack={() => {
                setSelectedQuiz(null);
                // Re-fetch to update taken status if needed, or just optimistically update parent
            }}
            addToast={addToast}
            onSubmitQuiz={async (answers) => {
                const supabase = requireSupabaseClient();
                const { error } = await supabase.rpc('submit_quiz_answers', { p_answers: answers });
                if (error) {
                    addToast(`Error: ${error.message}`, 'error');
                    return false;
                }
                setTakenQuizIds(prev => new Set(prev).add(selectedQuiz.id));
                addToast('Quiz submitted successfully!', 'success');
                return true;
            }}
        />
    }

    return (
        <div className="animate-fade-in">
            <QuizListView 
                quizzes={quizzes} 
                onTakeQuiz={setSelectedQuiz} 
                takenQuizIds={takenQuizIds} 
            />
        </div>
    );
}

export default StudentQuizzesView;