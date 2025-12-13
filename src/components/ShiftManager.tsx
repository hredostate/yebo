
import React, { useState, useMemo, useEffect } from 'react';
import type { TeacherShift, UserProfile, Holiday } from '../types';
import { PlusCircleIcon, TrashIcon, CalendarIcon, CloseIcon } from './common/icons';
import Spinner from './common/Spinner';
import SearchableSelect from './common/SearchableSelect';
import { supabase } from '../services/supabaseClient';

interface ShiftManagerProps {
    shifts: TeacherShift[];
    users: UserProfile[];
    onSave: (shift: Partial<TeacherShift>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
}

// --- Holidays Manager ---
const HolidaysManager: React.FC = () => {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            const { data } = await supabase.from('holidays').select('*').order('date', { ascending: true });
            if (data) setHolidays(data);
        };
        fetch();
    }, []);

    const handleAdd = async () => {
        if (!name || !date) return;
        setIsSaving(true);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('user_profiles').select('school_id').eq('id', user.id).single();
        
        const { error } = await supabase.from('holidays').insert({
            school_id: profile.school_id,
            name,
            date,
            is_recurring: isRecurring
        });

        if (!error) {
            setName('');
            setDate('');
            setIsRecurring(false);
            const { data } = await supabase.from('holidays').select('*').order('date', { ascending: true });
            if(data) setHolidays(data);
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: number) => {
        await supabase.from('holidays').delete().eq('id', id);
        setHolidays(prev => prev.filter(h => h.id !== id));
    };

    return (
        <div className="p-6 border rounded-xl bg-white dark:bg-slate-900 space-y-6 shadow-sm">
            <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 text-lg"><CalendarIcon className="w-5 h-5 text-orange-500" /> School Holidays</h3>
                <div className="text-xs text-slate-500">Exceptions to attendance rules</div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                <div className="flex-grow w-full">
                    <label className="block text-xs font-semibold mb-1">Holiday Name</label>
                    <input type="text" placeholder="e.g., Independence Day" value={name} onChange={e => setName(e.target.value)} className="p-2 border rounded w-full" />
                </div>
                <div className="w-full md:w-auto">
                    <label className="block text-xs font-semibold mb-1">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="p-2 border rounded w-full" />
                </div>
                <label className="flex items-center gap-2 p-2 border rounded bg-white dark:bg-slate-900 cursor-pointer h-[42px]">
                    <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
                    <span className="text-sm">Recurring (Yearly)</span>
                </label>
                <button onClick={handleAdd} disabled={isSaving} className="px-6 py-2 bg-green-600 text-white rounded font-bold h-[42px] min-w-[100px]">
                    {isSaving ? <Spinner size="sm"/> : 'Add'}
                </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
                {holidays.length === 0 && <p className="text-center text-slate-500 py-4">No holidays defined.</p>}
                {holidays.map(h => (
                    <div key={h.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                            <span className="font-semibold text-slate-800 dark:text-white">{h.name}</span>
                            <span className="text-sm text-slate-500 ml-3">{new Date(h.date).toDateString()}</span>
                            {h.is_recurring && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Recurring</span>}
                        </div>
                        <button onClick={() => handleDelete(h.id)} className="text-red-500 hover:bg-red-100 p-2 rounded-full transition-colors"><TrashIcon className="w-4 h-4"/></button>
                    </div>
                ))}
            </div>
        </div>
    )
}

// --- Bulk Shift Form ---
const BulkShiftForm: React.FC<{
    onSave: (shift: Partial<TeacherShift>[]) => Promise<void>;
    onCancel: () => void;
    isSaving: boolean;
    teachers: UserProfile[];
}> = ({ onSave, onCancel, isSaving, teachers }) => {
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
    const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set()); // 0=Sun...
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('16:00');
    const [applyToAll, setApplyToAll] = useState(false);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const toggleDay = (dayIndex: number) => {
        const newSet = new Set(selectedDays);
        if (newSet.has(dayIndex)) newSet.delete(dayIndex);
        else newSet.add(dayIndex);
        setSelectedDays(newSet);
    };

    const toggleTeacher = (id: string) => {
        const newSet = new Set(selectedTeacherIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedTeacherIds(newSet);
    }

    const toggleAllDays = () => {
        // If all weekdays (1-5) selected, clear. Else select Mon-Fri.
        const weekdays = [1,2,3,4,5];
        const allWeekdaysSelected = weekdays.every(d => selectedDays.has(d));
        if (allWeekdaysSelected) {
            setSelectedDays(new Set());
        } else {
            setSelectedDays(new Set(weekdays));
        }
    }

    const handleSave = () => {
        const targetTeachers = applyToAll ? teachers.map(t => t.id) : Array.from(selectedTeacherIds);
        
        if (targetTeachers.length === 0 || selectedDays.size === 0 || !startTime || !endTime) {
            alert("Please select staff, days, and times.");
            return;
        }

        const newShifts: Partial<TeacherShift>[] = [];
        targetTeachers.forEach(teacherId => {
            selectedDays.forEach(day => {
                newShifts.push({
                    teacher_id: teacherId,
                    day_of_week: day,
                    start_time: startTime,
                    end_time: endTime
                });
            });
        });
        onSave(newShifts);
    };

    return (
        <div className="p-6 border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl space-y-6 animate-fade-in shadow-lg">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-lg text-slate-800 dark:text-white">Bulk Shift Assignment</h4>
                <button onClick={onCancel} className="text-slate-500 hover:text-slate-700"><CloseIcon className="w-6 h-6" /></button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Time & Days */}
                <div className="space-y-6">
                    <div>
                        <label className="font-semibold text-sm mb-2 block text-slate-700 dark:text-slate-200">1. Schedule Time</label>
                        <div className="flex gap-4 items-center p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex-1">
                                <label className="block text-xs text-slate-500 mb-1">Start Time</label>
                                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-900" />
                            </div>
                            <span className="text-slate-400">to</span>
                            <div className="flex-1">
                                <label className="block text-xs text-slate-500 mb-1">End Time</label>
                                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-900" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-semibold text-sm block text-slate-700 dark:text-slate-200">2. Select Days</label>
                            <button onClick={toggleAllDays} className="text-xs text-blue-600 font-semibold hover:underline">Select Mon-Fri</button>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {dayNames.map((d, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => toggleDay(i)}
                                    className={`w-10 h-10 rounded-full text-sm font-bold flex items-center justify-center transition-all ${selectedDays.has(i) ? 'bg-blue-600 text-white shadow-md scale-110' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100'}`}
                                >
                                    {d.charAt(0)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Staff Selection */}
                <div>
                    <label className="font-semibold text-sm mb-2 block text-slate-700 dark:text-slate-200">3. Select Staff</label>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-64">
                        <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                                <input type="checkbox" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
                                Assign to All Active Staff
                            </label>
                        </div>
                        {!applyToAll && (
                            <div className="flex-grow overflow-y-auto p-2">
                                {teachers.map(t => (
                                    <label key={t.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedTeacherIds.has(t.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedTeacherIds.has(t.id)} 
                                            onChange={() => toggleTeacher(t.id)}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex-grow">
                                            <p className="text-sm font-medium text-slate-800 dark:text-white">{t.name}</p>
                                            <p className="text-xs text-slate-500">{t.role}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                        {applyToAll && (
                            <div className="flex-grow flex items-center justify-center text-slate-500 text-sm p-4 text-center">
                                This shift will be applied to all {teachers.length} staff members.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-blue-200 dark:border-blue-800">
                <button onClick={onCancel} className="px-5 py-2 bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center gap-2 disabled:opacity-70">
                    {isSaving ? <Spinner size="sm"/> : 'Assign Shifts'}
                </button>
            </div>
        </div>
    );
};

const ShiftManager: React.FC<ShiftManagerProps> = ({ shifts, users, onSave, onDelete }) => {
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'shifts' | 'holidays'>('shifts');
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const teachers = useMemo(() => users.filter(u => (u.role === 'Teacher' || u.role === 'Team Lead' || u.role === 'Principal' || u.role === 'Admin' || u.role === 'Maintenance' || u.role === 'School Secretary') && (!u.employment_status || u.employment_status === 'Active')).sort((a,b) => a.name.localeCompare(b.name)), [users]);

    const handleBulkSave = async (newShifts: Partial<TeacherShift>[]) => {
        setIsSaving(true);
        // Execute in batches or sequentially
        // Using Promise.all for speed, assuming DB can handle concurrent requests or Supabase batches
        const promises = newShifts.map(s => onSave(s));
        await Promise.all(promises);
        setIsSaving(false);
        setIsBulkMode(false);
    };
    
    // Group shifts by teacher for display
    const shiftsByTeacher = useMemo(() => {
        const grouped: Record<string, TeacherShift[]> = {};
        shifts.forEach(s => {
            if (!grouped[s.teacher_id]) grouped[s.teacher_id] = [];
            grouped[s.teacher_id].push(s);
        });
        return grouped;
    }, [shifts]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex space-x-1 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1 rounded-t-lg w-fit">
                <button 
                    onClick={() => setActiveTab('shifts')} 
                    className={`py-2 px-6 rounded-md text-sm font-semibold transition-all ${activeTab === 'shifts' ? 'bg-white dark:bg-slate-900 shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Staff Shifts
                </button>
                <button 
                    onClick={() => setActiveTab('holidays')} 
                    className={`py-2 px-6 rounded-md text-sm font-semibold transition-all ${activeTab === 'holidays' ? 'bg-white dark:bg-slate-900 shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    School Holidays
                </button>
            </div>

            {activeTab === 'holidays' && <HolidaysManager />}

            {activeTab === 'shifts' && (
                <div className="space-y-6">
                    {!isBulkMode && (
                         <div className="flex justify-end">
                            <button onClick={() => setIsBulkMode(true)} className="flex items-center gap-2 text-sm font-bold text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-transform hover:scale-105">
                                <PlusCircleIcon className="w-5 h-5"/> Assign Shifts
                            </button>
                        </div>
                    )}

                    {isBulkMode && (
                        <BulkShiftForm 
                            onSave={handleBulkSave} 
                            onCancel={() => setIsBulkMode(false)} 
                            isSaving={isSaving} 
                            teachers={teachers}
                        />
                    )}

                    {!isBulkMode && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.keys(shiftsByTeacher).length === 0 && (
                                <div className="col-span-full text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
                                    <p className="text-slate-500">No shifts configured yet.</p>
                                    <button onClick={() => setIsBulkMode(true)} className="text-blue-600 hover:underline mt-2">Get Started</button>
                                </div>
                            )}
                            {Object.entries(shiftsByTeacher).map(([teacherId, teacherShifts]) => {
                                const teacher = teachers.find(t => t.id === teacherId);
                                if (!teacher) return null; 

                                return (
                                    <div key={teacherId} className="p-4 border rounded-xl bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                                                {teacher.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">{teacher.name}</h4>
                                                <p className="text-xs text-slate-500">{teacher.role}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {teacherShifts.sort((a,b) => a.day_of_week - b.day_of_week).map(shift => (
                                                <div key={shift.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 group">
                                                    <span className={`font-bold w-8 ${[0,6].includes(shift.day_of_week) ? 'text-orange-500' : 'text-slate-600 dark:text-slate-300'}`}>{dayNames[shift.day_of_week]}</span>
                                                    <span className="font-mono text-slate-700 dark:text-slate-200">{shift.start_time.slice(0,5)} - {shift.end_time.slice(0,5)}</span>
                                                    <button onClick={() => onDelete(shift.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-3 h-3"/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ShiftManager;
