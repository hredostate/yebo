import React, { useState, useEffect, useCallback } from 'react';
import type { UserProfile, TeacherCheckin, Campus, TeacherMood } from '../types';
import { fetchMyCheckins } from '../services/checkins';
import Spinner from './common/Spinner';
import CheckinWidget from './widgets/CheckinWidget';

const TeacherCheckinHistory: React.FC<{
    history: TeacherCheckin[];
}> = ({ history }) => {
    return (
        <div className="p-6 rounded-2xl border bg-white/60 dark:bg-slate-900/40">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">My Recent Check-ins</h2>
            <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-2">
                {history.map(c => (
                    <div key={c.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg flex justify-between items-start bg-white dark:bg-slate-800">
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-white">{new Date(c.checkin_date + 'T00:00:00').toDateString()}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">Status: {c.status}</p>
                            <p className="text-xs text-slate-500">
                                In: {new Date(c.created_at).toLocaleTimeString()} | Out: {c.checkout_time ? new Date(c.checkout_time).toLocaleTimeString() : 'N/A'}
                            </p>
                            {c.notes && <p className="text-xs italic mt-1 text-slate-500">"{c.notes}"</p>}
                        </div>
                        {c.photo_url && <a href={c.photo_url} target="_blank" rel="noopener noreferrer"><img src={c.photo_url} alt="Check-in" className="w-16 h-16 rounded-md object-cover" /></a>}
                    </div>
                ))}
            </div>
        </div>
    );
};

interface TeacherCheckinViewProps {
    currentUser: UserProfile;
    addToast: (msg: string, tone?: 'info'|'success'|'error') => void;
    todaysCheckin?: TeacherCheckin | null;
    handleCheckinOut?: (notes?: string | null, isRemote?: boolean, location?: { lat: number; lng: number } | null, photoUrl?: string | null, mood?: TeacherMood | null) => Promise<boolean>;
    campuses?: Campus[];
}

const TeacherCheckinView: React.FC<TeacherCheckinViewProps> = ({ currentUser, addToast, todaysCheckin, handleCheckinOut, campuses }) => {
    const [history, setHistory] = useState<TeacherCheckin[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const loadHistory = useCallback(async () => {
        setIsLoadingHistory(true);
        const { data, error } = await fetchMyCheckins(currentUser.id, { limit: 30 });
        if (error) {
            addToast(`Error loading history: ${error}`, 'error');
        } else {
            setHistory(data);
        }
        setIsLoadingHistory(false);
    }, [addToast, currentUser.id]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory, todaysCheckin]);
    
    // Safe fallback for campuses to prevent runtime crashes if undefined
    const safeCampuses = campuses || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Daily Check-in</h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Check in for today and view your recent history.</p>
            </div>

            {handleCheckinOut ? (
                <CheckinWidget 
                    todaysCheckin={todaysCheckin}
                    onCheckinOut={handleCheckinOut}
                    isLoading={false} 
                    userProfile={currentUser}
                    campuses={safeCampuses}
                    addToast={addToast}
                />
            ) : (
                <div className="p-4 bg-red-100 text-red-800 rounded-lg">Error: Check-in function unavailable. Please refresh.</div>
            )}

            {isLoadingHistory ? <div className="flex justify-center p-10"><Spinner size="lg" /></div> : <TeacherCheckinHistory history={history} />}
        </div>
    );
};

export default TeacherCheckinView;