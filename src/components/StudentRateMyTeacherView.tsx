
import React, { useState, useEffect, useMemo } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { StudentProfile, Teacher, TeacherRating } from '../types';
import Spinner from './common/Spinner';

// Helper: Get Monday of the current week as a string
const getWeekStartDateString = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay(); // Sunday - 0, Monday - 1
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};

interface StudentRateMyTeacherViewProps {
    studentProfile: StudentProfile;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const StarRating: React.FC<{ rating: number; setRating: (r: number) => void; disabled: boolean }> = ({ rating, setRating, disabled }) => {
    const [hover, setHover] = useState(0);
    return (
        <div className="flex space-x-1">
            {[...Array(5)].map((_, index) => {
                const ratingValue = index + 1;
                return (
                    <button
                        type="button"
                        key={ratingValue}
                        className={`text-3xl ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => !disabled && setRating(ratingValue)}
                        onMouseEnter={() => !disabled && setHover(ratingValue)}
                        onMouseLeave={() => !disabled && setHover(0)}
                    >
                        <span className={ratingValue <= (hover || rating) ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'}>★</span>
                    </button>
                );
            })}
        </div>
    );
};

const StudentRateMyTeacherView: React.FC<StudentRateMyTeacherViewProps> = ({ studentProfile, addToast }) => {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [myRatings, setMyRatings] = useState<TeacherRating[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentWeekStart, setCurrentWeekStart] = useState('');
    const [ratingsToUpdate, setRatingsToUpdate] = useState<Record<string, { rating: number; comment: string | null }>>({});
    const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const weekStart = getWeekStartDateString(new Date());
            setCurrentWeekStart(weekStart);

            try {
                // Fetch teachers relevant to this student (simplified logic: fetch all teachers for now, 
                // in production this should filter by student's class/subjects)
                // Using a simplified query here assuming we can see all teachers or use an RPC
                const { data: teachersData, error: teachersError } = await supabase
                    .from('user_profiles')
                    .select('id, name, role')
                    .in('role', ['Teacher', 'Team Lead']);
                
                if (teachersError) throw teachersError;
                
                // Transform to Teacher type
                const mappedTeachers: Teacher[] = (teachersData || []).map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    teaches_this_student: true // Simplified
                }));
                
                setTeachers(mappedTeachers);

                // Fetch existing ratings for this week
                const { data: ratingsData, error: ratingsError } = await supabase
                    .from('teacher_ratings')
                    .select('*')
                    .eq('student_id', studentProfile.id) // Note: Schema uses UUID for student_id in ratings table based on user_id
                    .eq('week_start', weekStart);
                
                if (ratingsError && ratingsError.code !== 'PGRST116') { 
                   console.error(ratingsError);
                }
                
                if (ratingsData) {
                    setMyRatings(ratingsData);
                    const updates = ratingsData.reduce((acc: any, r: TeacherRating) => {
                        acc[r.teacher_id] = { rating: r.rating, comment: r.comment };
                        return acc;
                    }, {});
                    setRatingsToUpdate(updates);
                }
            } catch (error: any) {
                console.error('Error fetching rating data:', error);
                addToast('Failed to load data.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [studentProfile, addToast]);

    const filteredTeachers = useMemo(() => {
        return teachers.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [teachers, searchQuery]);

    const handleRatingChange = (teacherId: string, field: 'rating' | 'comment', value: number | string | null) => {
        setRatingsToUpdate(prev => ({
            ...prev,
            [teacherId]: {
                ...prev[teacherId],
                rating: field === 'rating' ? (value as number) : (prev[teacherId]?.rating || 0),
                comment: field === 'comment' ? (value as string | null) : prev[teacherId]?.comment,
            }
        }));
    };

    const handleSaveRating = async (teacherId: string) => {
        const ratingData = ratingsToUpdate[teacherId];
        if (!ratingData || ratingData.rating === 0) {
            addToast('Please select a rating from 1 to 5 stars.', 'error');
            return;
        }

        setIsSaving(prev => ({ ...prev, [teacherId]: true }));
        
        // Determine user ID for the student (assuming studentProfile.id is the UUID from auth)
        const studentUserId = studentProfile.id; 
        
        const { error } = await supabase.from('teacher_ratings').upsert({
            student_id: studentUserId,
            teacher_id: teacherId,
            week_start: currentWeekStart,
            rating: ratingData.rating,
            comment: ratingData.comment,
        }, { onConflict: 'student_id, teacher_id, week_start' });

        if (error) {
            addToast(`Failed to save rating: ${error.message}`, 'error');
        } else {
            addToast('Rating saved successfully!', 'success');
            // Update local state to reflect saved status
            const newRating: TeacherRating = {
                id: Date.now(), // temporary ID
                student_id: studentProfile.student_record_id,
                teacher_id: teacherId,
                week_start: currentWeekStart,
                rating: ratingData.rating,
                comment: ratingData.comment,
                created_at: new Date().toISOString()
            };
            setMyRatings(prev => [...prev.filter(r => r.teacher_id !== teacherId), newRating]);
        }
        setIsSaving(prev => ({ ...prev, [teacherId]: false }));
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Rate My Teacher</h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Your feedback is anonymous and valuable. Ratings can be updated until Sunday at midnight.</p>
            </div>

            <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40">
                <input
                    type="text"
                    placeholder="Search for a teacher..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            
            <div className="space-y-4">
                {filteredTeachers.length > 0 ? filteredTeachers.map(teacher => {
                    const ratingData = ratingsToUpdate[teacher.id];
                    const existingRating = myRatings.find(r => r.teacher_id === teacher.id);
                    const isSaved = !!existingRating;

                    return (
                        <div key={teacher.id} className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h2 className="font-bold text-lg text-slate-800 dark:text-white">{teacher.name}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Teacher</p>
                                </div>
                                <StarRating 
                                    rating={ratingData?.rating || 0} 
                                    setRating={(r) => handleRatingChange(teacher.id, 'rating', r)} 
                                    disabled={false} // Allow updating anytime during the week
                                />
                            </div>
                            <div className="mt-4 space-y-3">
                                <textarea
                                    placeholder="Add an optional comment about your experience this week..."
                                    value={ratingData?.comment || ''}
                                    onChange={e => handleRatingChange(teacher.id, 'comment', e.target.value)}
                                    className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-blue-500 text-sm"
                                    rows={2}
                                />
                                <div className="flex justify-end">
                                    <button 
                                        onClick={() => handleSaveRating(teacher.id)}
                                        disabled={isSaving[teacher.id]}
                                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center"
                                    >
                                        {isSaving[teacher.id] ? <Spinner size="sm" /> : (isSaved ? 'Update Rating' : 'Submit Rating')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }) : (
                    <div className="text-center p-8 text-slate-500">
                        No teachers found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentRateMyTeacherView;
