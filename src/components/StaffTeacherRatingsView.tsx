import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import type { UserProfile, TeacherRatingWeekly, MaskedTeacherRating } from '../types';
import Spinner from './common/Spinner';
import { isActiveEmployee } from '../utils/userHelpers';

// Helper: Get Monday of a given week
const getWeekStartDateString = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay(); // Sunday - 0, Monday - 1
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};

interface StaffTeacherRatingsViewProps {
  users: UserProfile[];
  weeklyRatings: TeacherRatingWeekly[];
  currentUser: UserProfile;
}

const StaffTeacherRatingsView: React.FC<StaffTeacherRatingsViewProps> = ({ users, weeklyRatings, currentUser }) => {
    const isAdmin = ['Admin', 'Principal'].includes(currentUser.role);
    
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>(!isAdmin ? currentUser.id : '');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [maskedComments, setMaskedComments] = useState<MaskedTeacherRating[]>([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);

    const weekStart = getWeekStartDateString(currentDate);

    const teachers = useMemo(() => users.filter(u => (u.role === 'Teacher' || u.role === 'Team Lead') && isActiveEmployee(u)), [users]);
    
    useEffect(() => {
        const fetchComments = async () => {
            if (!selectedTeacherId) {
                setMaskedComments([]);
                return;
            }
            setIsLoadingComments(true);
            const { data, error } = await supabase
                .from('v_teacher_ratings_masked')
                .select('*')
                .eq('teacher_id', selectedTeacherId)
                .eq('week_start', weekStart);
            
            if (error) {
                console.error('Error fetching masked comments:', error);
                setMaskedComments([]);
            } else {
                setMaskedComments(data || []);
            }
            setIsLoadingComments(false);
        };
        fetchComments();
    }, [selectedTeacherId, weekStart]);

    const handlePrevWeek = () => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)));
    const handleNextWeek = () => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)));

    const selectedTeacherData = weeklyRatings.find(r => r.teacher_id === selectedTeacherId && r.week_start === weekStart);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Teacher Ratings Analytics</h1>
                <p className="text-slate-600 mt-1">View anonymized weekly feedback and performance metrics.</p>
            </div>

            <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40 flex justify-between items-center">
                {isAdmin ? (
                    <div>
                        <label htmlFor="teacher-select" className="text-sm font-medium mr-2">Select Teacher:</label>
                        <select id="teacher-select" value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} className="p-2 rounded-md bg-transparent border border-slate-300 dark:border-slate-700">
                            <option value="">-- All Teachers --</option>
                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                ) : <div />}
                <div className="flex items-center gap-4">
                    <button onClick={handlePrevWeek} className="px-3 py-1 bg-slate-500/20 rounded-lg hover:bg-slate-500/30">&lt; Prev Week</button>
                    <span className="font-semibold">Week of {new Date(weekStart + 'T00:00:00').toLocaleDateString()}</span>
                    <button onClick={handleNextWeek} className="px-3 py-1 bg-slate-500/20 rounded-lg hover:bg-slate-500/30">Next Week &gt;</button>
                </div>
            </div>

            {!selectedTeacherId && isAdmin && (
                <div className="p-10 text-center rounded-xl border bg-white/60 dark:bg-slate-900/40">
                    <p>Please select a teacher to view their weekly rating summary.</p>
                </div>
            )}
            
            {selectedTeacherId && (
                <div className="space-y-4">
                    <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40">
                        <h2 className="font-bold text-lg mb-3">Weekly Summary for {teachers.find(t=>t.id === selectedTeacherId)?.name}</h2>
                        {selectedTeacherData ? (
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div className="p-3 bg-blue-500/10 rounded-lg"><p className="text-xs uppercase font-semibold text-blue-500">Avg Rating</p><p className="text-2xl font-bold">{Number(selectedTeacherData.weighted_avg).toFixed(2)}</p></div>
                                <div className="p-3 bg-slate-500/10 rounded-lg"><p className="text-xs uppercase font-semibold text-slate-500">Total Ratings</p><p className="text-2xl font-bold">{selectedTeacherData.rating_count}</p></div>
                                <div className="p-3 bg-red-500/10 rounded-lg"><p className="text-xs uppercase font-semibold text-red-500">Low Ratings (≤2)</p><p className="text-2xl font-bold">{selectedTeacherData.low_count}</p></div>
                                <div className="p-3 bg-green-500/10 rounded-lg"><p className="text-xs uppercase font-semibold text-green-500">Spotlight?</p><p className="text-2xl font-bold">{selectedTeacherData.spotlight ? '🏆 Yes' : 'No'}</p></div>
                            </div>
                        ) : (
                             <p className="text-center p-5 text-slate-500">No rating data available for this teacher for this week.</p>
                        )}
                    </div>
                     <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40">
                        <h2 className="font-bold text-lg mb-3">Anonymized Comments</h2>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {isLoadingComments ? <Spinner /> : maskedComments.length > 0 ? (
                                maskedComments.map(c => (
                                    <div key={c.id} className="p-3 bg-slate-500/10 rounded-lg border-l-4 border-slate-300 dark:border-slate-700">
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>From: {c.student_handle}</span>
                                            <span>Rating: {'★'.repeat(c.rating)}{'☆'.repeat(5 - c.rating)}</span>
                                        </div>
                                        <p className="mt-2 text-sm italic">"{c.comment || 'No comment provided.'}"</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500">No comments for this week.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffTeacherRatingsView;
