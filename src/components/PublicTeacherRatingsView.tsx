
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { PublicTeacher, PublicMaskedComment, PublicClass } from '../types';
import { ShieldIcon, StarIcon } from './common/icons';
import Spinner from './common/Spinner';
import { SCHOOL_LOGO_URL } from '../constants';

const Brand: React.FC = () => (
    <div className="group inline-flex items-center gap-3">
        <img src={SCHOOL_LOGO_URL} alt="Logo" className="h-10 w-10 object-contain" />
        <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">School Guardian 360</span>
    </div>
);

const StarRatingDisplay: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex text-yellow-400">
        {[...Array(5)].map((_, i) => (
            <svg key={i} className={`w-5 h-5 ${i < rating ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        ))}
    </div>
);

interface PublicTeacherRatingsViewProps {
    onShowLogin: () => void;
}

const PublicTeacherRatingsView: React.FC<PublicTeacherRatingsViewProps> = ({ onShowLogin }) => {
    const [leaderboard, setLeaderboard] = useState<PublicTeacher[]>([]);
    const [searchResults, setSearchResults] = useState<PublicTeacher[]>([]);
    const [selectedTeacher, setSelectedTeacher] = useState<PublicTeacher | null>(null);
    const [comments, setComments] = useState<PublicMaskedComment[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [allClasses, setAllClasses] = useState<PublicClass[]>([]);
    const [loading, setLoading] = useState({ leaderboard: true, search: false, comments: false });
    const [commentsPage, setCommentsPage] = useState(0);
    const [hasMoreComments, setHasMoreComments] = useState(true);

    const COMMENTS_PER_PAGE = 10;

    // Debounce search query
    useEffect(() => {
        const handler = setTimeout(() => {
            if (searchQuery.trim() || classFilter) {
                performSearch();
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery, classFilter]);
    
    // Initial data load
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(prev => ({ ...prev, leaderboard: true }));
            const { data: leaderboardData, error: leaderboardError } = await supabase
                .from('mv_public_teacher_leaderboard_current_week')
                .select('*')
                .order('rank_overall');

            if (leaderboardData) setLeaderboard(leaderboardData);
            if(leaderboardError) console.error("Leaderboard error:", leaderboardError.message);

            const { data: classesData, error: classesError } = await supabase
                .from('classes')
                .select('name')
                .order('name');
                
            if (classesData) setAllClasses(classesData);
            if(classesError) console.error("Classes error:", classesError.message);

            setLoading(prev => ({ ...prev, leaderboard: false }));
        };
        fetchInitialData();
    }, []);

    // Fetch comments for selected teacher
    const fetchComments = useCallback(async (teacherId: string, page: number) => {
        const supabase = requireSupabaseClient();
        setLoading(prev => ({...prev, comments: true}));
        const {data, error} = await supabase.rpc('teacher_comments_public', {
            p_teacher_id: teacherId,
            p_limit: COMMENTS_PER_PAGE,
            p_offset: page * COMMENTS_PER_PAGE,
        });

        if(data) {
            setComments(prev => page === 0 ? data : [...prev, ...data]);
            setHasMoreComments(data.length === COMMENTS_PER_PAGE);
        }
        if(error) console.error("Comments error:", error.message);
        setLoading(prev => ({...prev, comments: false}));
    }, []);

    useEffect(() => {
        if(selectedTeacher) {
            setComments([]);
            setCommentsPage(0);
            setHasMoreComments(true);
            fetchComments(selectedTeacher.teacher_id, 0);
        }
    }, [selectedTeacher, fetchComments]);


    const performSearch = async () => {
        const supabase = requireSupabaseClient();
        setLoading(prev => ({ ...prev, search: true }));
        const { data, error } = await supabase.rpc('search_teachers_public', {
            q: searchQuery || undefined,
            p_class_name: classFilter || undefined,
        });
        if(data) setSearchResults(data);
        if(error) console.error("Search error:", error.message);
        setLoading(prev => ({ ...prev, search: false }));
    };
    
    const handleSelectTeacher = (teacher: PublicTeacher) => {
        setSelectedTeacher(teacher);
    };

    const renderTeacherCard = (teacher: PublicTeacher, isLeaderboard: boolean = false) => (
        <div key={teacher.teacher_id} onClick={() => handleSelectTeacher(teacher)} className="p-4 rounded-lg border border-slate-200/60 bg-white/50 dark:border-slate-800/60 dark:bg-slate-900/50 hover:bg-blue-500/10 hover:border-blue-500/30 cursor-pointer transition-colors">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-slate-800 dark:text-white">{teacher.teacher_name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {teacher.classes_taught?.slice(0, 3).map(c => <span key={c} className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full">{c}</span>)}
                        {teacher.classes_taught?.length > 3 && <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full">+{teacher.classes_taught.length - 3} more</span>}
                    </div>
                </div>
                {isLeaderboard && <span className="text-2xl font-bold text-slate-400">#{teacher.rank_overall}</span>}
            </div>
            {teacher.weighted_avg !== null && (
                <div className="flex items-center justify-between mt-3 text-sm border-t border-slate-200/60 dark:border-slate-700/60 pt-2">
                    <div className="flex items-center gap-1">
                        <StarIcon className="w-5 h-5 text-yellow-400"/>
                        <span className="font-bold">{Number(teacher.weighted_avg).toFixed(2)}</span>
                        <span className="text-xs text-slate-500">({teacher.rating_count} ratings)</span>
                    </div>
                    {teacher.spotlight && <span className="text-xs font-semibold px-2 py-0.5 bg-green-200 text-green-800 rounded-full">🏆 Spotlight</span>}
                </div>
            )}
        </div>
    )

    return (
        <div className="h-full w-full overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100">
            <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
                <Brand />
                <button onClick={onShowLogin} className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Staff Login</button>
            </header>
            
            <main className="mx-auto max-w-7xl px-6 pb-10">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold tracking-tight">Teacher Ratings Dashboard</h1>
                    <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">Public feedback and performance metrics for our teaching staff.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Search & Results */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40">
                            <h2 className="font-bold text-lg mb-2">Find a Teacher</h2>
                            <div className="space-y-3">
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name..." className="w-full p-2 bg-transparent border border-slate-300 dark:border-slate-700 rounded-md"/>
                                <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="w-full p-2 bg-transparent border border-slate-300 dark:border-slate-700 rounded-md">
                                    <option value="">Filter by class...</option>
                                    {allClasses.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                            {loading.search && <div className="flex justify-center p-4"><Spinner/></div>}
                            {(searchQuery || classFilter) && searchResults.map(t => renderTeacherCard(t))}
                            {(searchQuery || classFilter) && !loading.search && searchResults.length === 0 && <p className="text-center text-sm text-slate-500">No teachers found.</p>}
                        </div>
                    </div>

                    {/* Right Column: Leaderboard or Details */}
                    <div className="lg:col-span-2">
                        {selectedTeacher ? (
                             <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40 animate-fade-in">
                                <button onClick={() => setSelectedTeacher(null)} className="text-sm text-blue-600 mb-4">&larr; Back to Leaderboard</button>
                                {renderTeacherCard(selectedTeacher)}
                                <div className="mt-4 border-t border-slate-200/60 dark:border-slate-700/60 pt-4">
                                    <h3 className="font-bold text-lg mb-2">Recent Anonymized Comments</h3>
                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {loading.comments && comments.length === 0 && <div className="flex justify-center p-4"><Spinner/></div>}
                                        {comments.map(c => (
                                            <div key={c.created_at} className="p-3 bg-slate-500/10 rounded-lg">
                                                <div className="flex justify-between items-center text-xs text-slate-500">
                                                    <span>From: {c.student_handle}</span>
                                                    <StarRatingDisplay rating={c.rating}/>
                                                </div>
                                                <p className="mt-2 text-sm italic">"{c.comment || 'No comment provided.'}"</p>
                                            </div>
                                        ))}
                                         {!loading.comments && hasMoreComments && <button onClick={() => {setCommentsPage(p => p + 1); fetchComments(selectedTeacher.teacher_id, commentsPage + 1)}} className="w-full text-sm p-2 bg-slate-200 dark:bg-slate-700 rounded-md">Load More</button>}
                                        {!loading.comments && comments.length === 0 && <p className="text-sm text-center p-4 text-slate-500">No comments for this teacher this week.</p>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40">
                                <h2 className="font-bold text-lg mb-2">🏆 Top Teachers This Week</h2>
                                <div className="space-y-3">
                                    {loading.leaderboard && <div className="flex justify-center p-4"><Spinner/></div>}
                                    {leaderboard.map(t => renderTeacherCard(t, true))}
                                    {!loading.leaderboard && leaderboard.length === 0 && <p className="text-center text-sm p-4 text-slate-500">No ratings data available for this week yet.</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PublicTeacherRatingsView;
