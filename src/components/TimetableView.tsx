
import React, { useState, useEffect, useMemo } from 'react';
import { supa as supabase } from '../offline/client';
import type { TimetablePeriod, TimetableEntry, TimetableLocation, UserProfile, AcademicClass, BaseDataObject, Term, Campus } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, TrashIcon, EditIcon, ClockIcon, CheckCircleIcon, MapPinIcon } from './common/icons';
import SearchableSelect from './common/SearchableSelect';
import { mapSupabaseError } from '../utils/errorHandling';
import { isActiveEmployee } from '../utils/userHelpers';

interface TimetableViewProps {
    userProfile?: UserProfile;
    users?: UserProfile[];
    terms?: Term[];
    academicClasses?: AcademicClass[];
    subjects?: BaseDataObject[];
    campuses?: Campus[];
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    studentViewClassId?: number; // For Student Portal Read-only View
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// --- Period Manager Component (Admin Only) ---
const PeriodManager: React.FC<{
    periods: TimetablePeriod[];
    onSave: (period: Partial<TimetablePeriod>) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
}> = ({ periods, onSave, onDelete }) => {
    const [editingPeriod, setEditingPeriod] = useState<Partial<TimetablePeriod> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!editingPeriod || !editingPeriod.name || !editingPeriod.start_time || !editingPeriod.end_time) return;
        setIsSaving(true);
        await onSave(editingPeriod);
        setIsSaving(false);
        setEditingPeriod(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Bell Schedule</h3>
                <button onClick={() => setEditingPeriod({ type: 'lesson' })} className="flex items-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg">
                    <PlusCircleIcon className="w-4 h-4" /> Add Period
                </button>
            </div>

            {editingPeriod && (
                <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3 animate-fade-in">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <input type="text" placeholder="Name (e.g. Period 1)" value={editingPeriod.name || ''} onChange={e => setEditingPeriod({...editingPeriod, name: e.target.value})} className="p-2 border rounded-md col-span-2" />
                        <input type="time" value={editingPeriod.start_time || ''} onChange={e => setEditingPeriod({...editingPeriod, start_time: e.target.value})} className="p-2 border rounded-md" />
                        <input type="time" value={editingPeriod.end_time || ''} onChange={e => setEditingPeriod({...editingPeriod, end_time: e.target.value})} className="p-2 border rounded-md" />
                        <select value={editingPeriod.type || 'lesson'} onChange={e => setEditingPeriod({...editingPeriod, type: e.target.value as any})} className="p-2 border rounded-md">
                            <option value="lesson">Lesson</option>
                            <option value="break">Break</option>
                            <option value="homeroom">Homeroom</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingPeriod(null)} className="px-3 py-1.5 text-sm bg-slate-200 rounded-md">Cancel</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md flex items-center gap-2">
                            {isSaving && <Spinner size="sm"/>} Save
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {periods.sort((a,b) => a.start_time.localeCompare(b.start_time)).map(period => (
                    <div key={period.id} className="p-3 border rounded-lg flex justify-between items-center bg-white dark:bg-slate-900">
                        <div className="flex items-center gap-4">
                            <div className={`w-2 h-8 rounded-full ${period.type === 'break' ? 'bg-yellow-400' : 'bg-blue-600'}`}></div>
                            <div>
                                <p className="font-semibold">{period.name}</p>
                                <p className="text-xs text-slate-500">{period.start_time.substring(0,5)} - {period.end_time.substring(0,5)} • {period.type.toUpperCase()}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingPeriod(period)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><EditIcon className="w-4 h-4"/></button>
                            <button onClick={() => onDelete(period.id)} className="text-red-600 hover:bg-red-50 p-1 rounded"><TrashIcon className="w-4 h-4"/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Location Manager Component (Admin Only) ---
const LocationManager: React.FC<{
    locations: TimetableLocation[];
    campuses: Campus[];
    onSave: (location: Partial<TimetableLocation>) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
}> = ({ locations, campuses, onSave, onDelete }) => {
    const [editingLocation, setEditingLocation] = useState<Partial<TimetableLocation> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!editingLocation || !editingLocation.name || !editingLocation.campus_id) return;
        setIsSaving(true);
        await onSave(editingLocation);
        setIsSaving(false);
        setEditingLocation(null);
    };

    // Group locations by campus
    const locationsByCampus = useMemo(() => {
        const grouped: Record<number, TimetableLocation[]> = {};
        locations.forEach(loc => {
            if (!grouped[loc.campus_id]) grouped[loc.campus_id] = [];
            grouped[loc.campus_id].push(loc);
        });
        return grouped;
    }, [locations]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPinIcon className="w-5 h-5 text-green-600" />
                    Locations
                </h3>
                <button onClick={() => setEditingLocation({ campus_id: campuses[0]?.id })} className="flex items-center gap-2 text-sm font-semibold text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg">
                    <PlusCircleIcon className="w-4 h-4" /> Add Location
                </button>
            </div>

            {editingLocation && (
                <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select 
                            value={editingLocation.campus_id || ''} 
                            onChange={e => setEditingLocation({...editingLocation, campus_id: Number(e.target.value)})} 
                            className="p-2 border rounded-md"
                        >
                            <option value="">Select Campus</option>
                            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <input 
                            type="text" 
                            placeholder="Location Name (e.g. Room 101, Lab A)" 
                            value={editingLocation.name || ''} 
                            onChange={e => setEditingLocation({...editingLocation, name: e.target.value})} 
                            className="p-2 border rounded-md" 
                        />
                        <input 
                            type="number" 
                            placeholder="Capacity (optional)" 
                            value={editingLocation.capacity || ''} 
                            onChange={e => setEditingLocation({...editingLocation, capacity: e.target.value ? Number(e.target.value) : undefined})} 
                            className="p-2 border rounded-md" 
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingLocation(null)} className="px-3 py-1.5 text-sm bg-slate-200 rounded-md">Cancel</button>
                        <button onClick={handleSave} disabled={isSaving || !editingLocation.name || !editingLocation.campus_id} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md flex items-center gap-2 disabled:opacity-50">
                            {isSaving && <Spinner size="sm"/>} Save
                        </button>
                    </div>
                </div>
            )}

            {campuses.length === 0 ? (
                <div className="p-4 text-center text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    No campuses configured. Please add campuses first.
                </div>
            ) : (
                <div className="space-y-4">
                    {campuses.map(campus => (
                        <div key={campus.id} className="border rounded-lg overflow-hidden">
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 font-semibold text-sm">
                                {campus.name}
                            </div>
                            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                {(locationsByCampus[campus.id] || []).length === 0 ? (
                                    <div className="p-3 text-sm text-slate-500 italic">No locations for this campus</div>
                                ) : (
                                    (locationsByCampus[campus.id] || []).map(location => (
                                        <div key={location.id} className="p-3 flex justify-between items-center bg-white dark:bg-slate-900">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-8 rounded-full bg-green-500"></div>
                                                <div>
                                                    <p className="font-semibold">{location.name}</p>
                                                    {location.capacity && (
                                                        <p className="text-xs text-slate-500">Capacity: {location.capacity}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingLocation(location)} className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                                                    <EditIcon className="w-4 h-4"/>
                                                </button>
                                                <button onClick={() => onDelete(location.id)} className="text-red-600 hover:bg-red-50 p-1 rounded">
                                                    <TrashIcon className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Entry Modal ---
interface EntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (entry: Partial<TimetableEntry>) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
    day: string;
    period: TimetablePeriod;
    academicClasses: AcademicClass[];
    subjects: BaseDataObject[];
    users: UserProfile[];
    locations: TimetableLocation[];
    initialData?: TimetableEntry | null;
    fixedTeacherId?: string; // If user is a teacher editing their own
    existingEntries: TimetableEntry[]; // For conflict detection
}

const EntryModal: React.FC<EntryModalProps> = ({ isOpen, onClose, onSave, onDelete, day, period, academicClasses, subjects, users, locations, initialData, fixedTeacherId, existingEntries }) => {
    const [classId, setClassId] = useState<number | ''>(initialData?.academic_class_id || '');
    const [subjectId, setSubjectId] = useState<number | ''>(initialData?.subject_id || '');
    const [teacherId, setTeacherId] = useState<string>(initialData?.teacher_id || fixedTeacherId || '');
    const [room, setRoom] = useState(initialData?.room_number || '');
    const [locationId, setLocationId] = useState<number | ''>(initialData?.location_id || '');
    const [isSaving, setIsSaving] = useState(false);
    const [conflict, setConflict] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            let currentConflict = null;
            if (teacherId) {
                // Check if this teacher is already booked in another class/slot at this time
                const teacherBusy = existingEntries.find(e => 
                    e.day_of_week === day && 
                    e.period_id === period.id && 
                    e.teacher_id === teacherId && 
                    e.id !== initialData?.id
                );
                if (teacherBusy) {
                    currentConflict = `Teacher is already assigned to ${teacherBusy.academic_class?.name} at this time.`;
                }
            }
            
            if (!currentConflict && classId) {
                // Check if this class already has a lesson at this time
                const classBusy = existingEntries.find(e => 
                    e.day_of_week === day && 
                    e.period_id === period.id && 
                    e.academic_class_id === classId && 
                    e.id !== initialData?.id
                );
                 if (classBusy) {
                    currentConflict = `Class ${classBusy.academic_class?.name} already has ${classBusy.subject?.name} at this time.`;
                }
            }
            
            // Check if this location is already booked at this time
            if (!currentConflict && locationId) {
                const locationBusy = existingEntries.find(e => 
                    e.day_of_week === day && 
                    e.period_id === period.id && 
                    e.location_id === locationId && 
                    e.id !== initialData?.id
                );
                if (locationBusy) {
                    const locationName = locations.find(l => l.id === locationId)?.name || 'Location';
                    currentConflict = `${locationName} is already booked for ${locationBusy.academic_class?.name} at this time.`;
                }
            }
            setConflict(currentConflict);
        }
    }, [classId, teacherId, locationId, day, period, existingEntries, initialData, isOpen, locations]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!classId || !subjectId || !teacherId) return;
        if (conflict) return; // Prevent submission if conflict exists
        
        setIsSaving(true);
        await onSave({
            id: initialData?.id,
            day_of_week: day,
            period_id: period.id,
            academic_class_id: Number(classId),
            subject_id: Number(subjectId),
            teacher_id: teacherId,
            room_number: room,
            location_id: locationId ? Number(locationId) : null
        });
        setIsSaving(false);
        onClose();
    };
    
    const handleDelete = async () => {
        if (initialData?.id) {
            if(window.confirm('Clear this slot?')) {
                await onDelete(initialData.id);
                onClose();
            }
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-md m-4">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-lg font-bold mb-1">{initialData ? 'Edit Slot' : fixedTeacherId ? 'Claim Slot' : 'Assign Slot'}</h3>
                        <p className="text-sm text-slate-500">{day} • {period.name} ({period.start_time.slice(0,5)}-{period.end_time.slice(0,5)})</p>
                    </div>
                    {initialData && <button onClick={handleDelete} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>}
                </div>
                
                {conflict && (
                    <div className="mb-4 p-3 bg-red-100 text-red-800 text-sm rounded-lg border border-red-200 flex items-start gap-2">
                        <span>⚠️</span> <span>{conflict}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Class</label>
                        <select value={classId} onChange={e => setClassId(Number(e.target.value))} className="w-full p-2 rounded border bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                            <option value="">Select Class</option>
                            {academicClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Subject</label>
                        <select value={subjectId} onChange={e => setSubjectId(Number(e.target.value))} className="w-full p-2 rounded border bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                            <option value="">Select Subject</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Teacher</label>
                        {fixedTeacherId ? (
                            <input type="text" value={users.find(u => u.id === fixedTeacherId)?.name || 'You'} disabled className="w-full p-2 rounded border bg-slate-100 dark:bg-slate-700 text-slate-500 cursor-not-allowed" />
                        ) : (
                             <SearchableSelect 
                                options={users.filter(u => (u.role === 'Teacher' || u.role === 'Team Lead') && isActiveEmployee(u)).map(u => ({ value: u.id, label: u.name }))} 
                                value={teacherId} 
                                onChange={(val) => setTeacherId(String(val))} 
                                placeholder="Select Teacher"
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Location (Optional)</label>
                        <select value={locationId} onChange={e => setLocationId(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 rounded border bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                            <option value="">No Location</option>
                            {locations.map(l => (
                                <option key={l.id} value={l.id}>
                                    {l.name}{l.campus?.name ? ` (${l.campus.name})` : ''}{l.capacity ? ` - Cap: ${l.capacity}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Room Override (Optional)</label>
                        <input type="text" value={room} onChange={e => setRoom(e.target.value)} className="w-full p-2 rounded border bg-white dark:bg-slate-800" placeholder="e.g. Room 301 (if different from location)" />
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md text-sm">Cancel</button>
                        <button type="submit" disabled={isSaving || !!conflict} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                            {isSaving ? <Spinner size="sm"/> : fixedTeacherId ? 'Claim' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Main Timetable Grid View ---
const TimetableGrid: React.FC<{
    entries: TimetableEntry[];
    periods: TimetablePeriod[];
    viewMode: 'teacher' | 'class' | 'student';
    filterId: string | number | null; // Teacher ID or Class ID
    onEditEntry: (day: string, period: TimetablePeriod, entry?: TimetableEntry) => void;
    readOnly?: boolean;
}> = ({ entries, periods, viewMode, filterId, onEditEntry, readOnly }) => {
    
    // Filter entries based on view mode
    const displayEntries = useMemo(() => {
        if (!filterId) return [];
        return entries.filter(e => 
            (viewMode === 'teacher' ? e.teacher_id === filterId : e.academic_class_id === filterId)
        );
    }, [entries, viewMode, filterId]);

    // Sort periods
    const sortedPeriods = useMemo(() => [...periods].sort((a,b) => a.start_time.localeCompare(b.start_time)), [periods]);

    if (!filterId) {
        return <div className="p-12 text-center text-slate-500 border-2 border-dashed rounded-xl">Select a {viewMode} to view timetable.</div>;
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <th className="p-3 border border-slate-200 dark:border-slate-700 w-32 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10">Period</th>
                        {DAYS_OF_WEEK.map(day => (
                            <th key={day} className="p-3 border border-slate-200 dark:border-slate-700 min-w-[140px]">{day}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedPeriods.map(period => (
                        <tr key={period.id}>
                            <td className="p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sticky left-0 font-medium text-xs z-10">
                                <div className="font-bold text-slate-900 dark:text-white">{period.name}</div>
                                <div className="text-slate-500">{period.start_time.slice(0,5)} - {period.end_time.slice(0,5)}</div>
                            </td>
                            {DAYS_OF_WEEK.map(day => {
                                const entry = displayEntries.find(e => e.period_id === period.id && e.day_of_week === day);
                                const isBreak = period.type === 'break';
                                
                                if (isBreak) {
                                    return <td key={day} className="p-1 border border-slate-200 dark:border-slate-700 bg-yellow-50/50 dark:bg-yellow-900/10 text-center text-xs text-yellow-700 dark:text-yellow-500 uppercase tracking-widest">Break</td>;
                                }

                                return (
                                    <td 
                                        key={day} 
                                        onClick={() => !readOnly && onEditEntry(day, period, entry)}
                                        className={`p-2 border border-slate-200 dark:border-slate-700 transition-colors h-24 align-top relative group ${readOnly ? '' : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20'} ${entry ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/30 dark:bg-slate-800/30'}`}
                                    >
                                        {entry ? (
                                            <div className="h-full flex flex-col">
                                                <div className="font-bold text-blue-700 dark:text-blue-400 line-clamp-2">
                                                    {entry.subject?.name}
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                    {viewMode === 'teacher' ? entry.academic_class?.name : entry.teacher?.name}
                                                </div>
                                                {entry.room_number && (
                                                    <div className="text-[10px] text-slate-400 mt-auto flex items-center gap-1">
                                                        <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{entry.room_number}</span>
                                                    </div>
                                                )}
                                                {!readOnly && (
                                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <EditIcon className="w-3 h-3 text-slate-400" />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            !readOnly && (
                                                <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <PlusCircleIcon className="w-5 h-5 text-slate-300" />
                                                </div>
                                            )
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// --- Main Component ---
const TimetableView: React.FC<TimetableViewProps> = ({ userProfile, users = [], terms = [], academicClasses = [], subjects = [], campuses = [], addToast, studentViewClassId }) => {
    const [activeTab, setActiveTab] = useState<'my_timetable' | 'master' | 'config'>('my_timetable');
    const [configSubTab, setConfigSubTab] = useState<'periods' | 'locations'>('periods');
    const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
    const [entries, setEntries] = useState<TimetableEntry[]>([]);
    const [locations, setLocations] = useState<TimetableLocation[]>([]);
    const [selectedTermId, setSelectedTermId] = useState<number | ''>('');
    const [isLoading, setIsLoading] = useState(true);
    const [localTerms, setLocalTerms] = useState<Term[]>(terms); // Local state for terms if props empty
    const [localCampuses, setLocalCampuses] = useState<Campus[]>(campuses);

    // Master view filters
    const [masterViewMode, setMasterViewMode] = useState<'teacher' | 'class'>('class');
    const [masterFilterId, setMasterFilterId] = useState<string | number | null>(null);

    // Modal state
    const [entryModalOpen, setEntryModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{day: string, period: TimetablePeriod, entry?: TimetableEntry} | null>(null);

    // Determine Mode
    const isStudent = !!studentViewClassId;
    const isAdmin = !isStudent && userProfile && ['Admin', 'Principal', 'Team Lead'].includes(userProfile.role);
    
    // Fetch Terms if missing (Student View scenario)
    useEffect(() => {
        if (localTerms.length === 0) {
            const fetchTerms = async () => {
                const { data } = await supabase.from('terms').select('*').eq('is_active', true);
                if (data && data.length > 0) {
                    setLocalTerms(data);
                    setSelectedTermId(data[0].id);
                } else {
                     // Fallback fetch all if none active
                     const { data: allTerms } = await supabase.from('terms').select('*').order('start_date', { ascending: false });
                     if(allTerms && allTerms.length > 0) {
                         setLocalTerms(allTerms);
                         setSelectedTermId(allTerms[0].id);
                     }
                }
            };
            fetchTerms();
        } else if (!selectedTermId) {
            const active = localTerms.find(t => t.is_active) || localTerms[0];
            if(active) setSelectedTermId(active.id);
        }
    }, [localTerms, selectedTermId]);

    // Fetch Campuses if missing
    useEffect(() => {
        if (localCampuses.length === 0 && userProfile) {
            const fetchCampuses = async () => {
                const { data } = await supabase.from('campuses').select('*').eq('school_id', userProfile.school_id);
                if (data) setLocalCampuses(data);
            };
            fetchCampuses();
        }
    }, [localCampuses, userProfile]);

    // Fetch Data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const [pRes, eRes, lRes] = await Promise.all([
                supabase.from('timetable_periods').select('*'),
                selectedTermId ? supabase.from('timetable_entries').select('*, academic_class:academic_classes(name), subject:subjects(name), teacher:user_profiles(name), location:timetable_locations(name, capacity)').eq('term_id', selectedTermId) : { data: [] },
                supabase.from('timetable_locations').select('*, campus:campuses(name)')
            ]);
            
            if (pRes.data) setPeriods(pRes.data);
            if (eRes.data) setEntries(eRes.data);
            if (lRes.data) setLocations(lRes.data);
            setIsLoading(false);
        };
        
        if (selectedTermId) loadData();
    }, [selectedTermId]);

    // Period Management Handlers
    const handleSavePeriod = async (period: Partial<TimetablePeriod>) => {
        if (!userProfile) return;
        const payload = { ...period, school_id: userProfile.school_id };
        if (period.id) {
            await supabase.from('timetable_periods').update(payload).eq('id', period.id);
        } else {
            await supabase.from('timetable_periods').insert(payload);
        }
        const { data } = await supabase.from('timetable_periods').select('*');
        if(data) setPeriods(data);
        addToast('Period saved', 'success');
    };

    const handleDeletePeriod = async (id: number) => {
        if (window.confirm("Delete this period? All associated entries will be removed.")) {
            await supabase.from('timetable_periods').delete().eq('id', id);
            setPeriods(prev => prev.filter(p => p.id !== id));
        }
    };

    // Location Management Handlers
    const handleSaveLocation = async (location: Partial<TimetableLocation>) => {
        if (!userProfile) return;
        const payload = { 
            name: location.name, 
            campus_id: location.campus_id, 
            capacity: location.capacity || null,
            school_id: userProfile.school_id 
        };
        if (location.id) {
            await supabase.from('timetable_locations').update(payload).eq('id', location.id);
        } else {
            await supabase.from('timetable_locations').insert(payload);
        }
        const { data } = await supabase.from('timetable_locations').select('*, campus:campuses(name)');
        if(data) setLocations(data);
        addToast('Location saved', 'success');
    };

    const handleDeleteLocation = async (id: number) => {
        if (window.confirm("Delete this location? Associated timetable entries will have their location cleared.")) {
            await supabase.from('timetable_locations').delete().eq('id', id);
            setLocations(prev => prev.filter(l => l.id !== id));
            addToast('Location deleted', 'success');
        }
    };

    // Entry Handlers
    const handleSaveEntry = async (entry: Partial<TimetableEntry>) => {
        if (!userProfile && !isStudent) return; // Guard for no profile unless student view (but student view is read only)
        if (isStudent) return; // Double check

        // Basic conflict check before sending to DB, though DB constraint will catch it too
        // handled in modal
        
        const payload = { ...entry, school_id: userProfile!.school_id, term_id: selectedTermId };
        
        let error;
        if (entry.id) {
            const res = await supabase.from('timetable_entries').update(payload).eq('id', entry.id);
            error = res.error;
        } else {
            const res = await supabase.from('timetable_entries').insert(payload);
            error = res.error;
        }

        if (error) {
            if (error.message.includes('unique_teacher_slot')) {
                addToast('Double Booking Error: This teacher is already busy at this time.', 'error');
            } else if (error.message.includes('unique_class_slot')) {
                addToast('Double Booking Error: This class already has a lesson at this time.', 'error');
            } else if (error.message.includes('unique_location_slot')) {
                addToast('Double Booking Error: This location is already booked at this time.', 'error');
            } else {
                const userFriendlyMessage = mapSupabaseError(error);
                addToast(`Error saving entry: ${userFriendlyMessage}`, 'error');
            }
        } else {
            addToast('Timetable updated', 'success');
            const { data } = await supabase.from('timetable_entries').select('*, academic_class:academic_classes(name), subject:subjects(name), teacher:user_profiles(name), location:timetable_locations(name, capacity)').eq('term_id', selectedTermId!);
            if(data) setEntries(data);
        }
    };

    const handleDeleteEntry = async (id: number) => {
        const { error } = await supabase.from('timetable_entries').delete().eq('id', id);
        if (error) {
            addToast('Failed to delete entry', 'error');
        } else {
            const { data } = await supabase.from('timetable_entries').select('*, academic_class:academic_classes(name), subject:subjects(name), teacher:user_profiles(name), location:timetable_locations(name, capacity)').eq('term_id', selectedTermId!);
            if(data) setEntries(data);
            addToast('Entry deleted', 'success');
        }
    }

    const handleEditClick = (day: string, period: TimetablePeriod, entry?: TimetableEntry) => {
        if (isStudent) return;

        const isMyTimetable = activeTab === 'my_timetable';
        const isOwner = entry?.teacher_id === userProfile?.id;
        const isEmpty = !entry;
        
        // Allow editing if: Admin OR (My Timetable AND (Empty OR Owned))
        if (isAdmin || (isMyTimetable && (isEmpty || isOwner))) {
            setSelectedSlot({ day, period, entry });
            setEntryModalOpen(true);
        } else {
            addToast("You don't have permission to edit this slot.", 'info');
        }
    };
    
    // --- Render Student View ---
    if (isStudent) {
         const studentClass = academicClasses.find(c => c.id === studentViewClassId);
         
         return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                     <div>
                         <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <ClockIcon className="w-6 h-6 text-blue-600" /> Class Timetable
                        </h1>
                        {studentClass && (
                            <p className="text-slate-600 dark:text-slate-400 mt-1">
                                {studentClass.name}
                            </p>
                        )}
                     </div>
                     {isLoading && <Spinner size="sm" />}
                </div>
                
                {!isLoading && periods.length > 0 ? (
                    <TimetableGrid 
                        entries={entries} 
                        periods={periods} 
                        viewMode="class"
                        filterId={studentViewClassId || null} 
                        onEditEntry={() => {}}
                        readOnly={true}
                    />
                ) : (
                    <div className="p-8 text-center text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        {isLoading ? 'Loading timetable...' : 'No timetable published for this term yet.'}
                    </div>
                )}
            </div>
         )
    }

    // --- Render Staff/Admin View ---
    if (!userProfile) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <ClockIcon className="w-8 h-8 text-blue-600" />
                        Timetable & Scheduling
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Manage periods, locations and assign classes.</p>
                </div>
                <div className="flex items-center gap-2">
                     <select 
                        value={selectedTermId} 
                        onChange={e => setSelectedTermId(Number(e.target.value))} 
                        className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm"
                    >
                        {localTerms.map(t => <option key={t.id} value={t.id}>{t.session_label} - {t.term_label}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6">
                    <button onClick={() => setActiveTab('my_timetable')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'my_timetable' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>My Timetable</button>
                    {isAdmin && <button onClick={() => setActiveTab('master')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'master' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Master Schedule</button>}
                    {isAdmin && <button onClick={() => setActiveTab('config')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'config' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Configuration</button>}
                </nav>
            </div>

            {isLoading && <div className="flex justify-center py-10"><Spinner size="lg"/></div>}

            {!isLoading && activeTab === 'config' && (
                <div className="space-y-6">
                    {/* Sub-tabs for configuration */}
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setConfigSubTab('periods')} 
                            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${configSubTab === 'periods' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'}`}
                        >
                            Bell Schedule
                        </button>
                        <button 
                            onClick={() => setConfigSubTab('locations')} 
                            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-2 ${configSubTab === 'locations' ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'}`}
                        >
                            <MapPinIcon className="w-4 h-4" />
                            Locations
                        </button>
                    </div>
                    
                    {configSubTab === 'periods' && (
                        <PeriodManager periods={periods} onSave={handleSavePeriod} onDelete={handleDeletePeriod} />
                    )}
                    
                    {configSubTab === 'locations' && (
                        <LocationManager 
                            locations={locations} 
                            campuses={localCampuses} 
                            onSave={handleSaveLocation} 
                            onDelete={handleDeleteLocation} 
                        />
                    )}
                </div>
            )}

            {!isLoading && activeTab === 'my_timetable' && (
                <div className="space-y-4">
                     <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                         <strong>How it works:</strong> Click on any empty slot to "Claim" it for a class you teach. The system will prevent double-booking.
                     </div>
                    <TimetableGrid 
                        entries={entries} 
                        periods={periods} 
                        viewMode="teacher" 
                        filterId={userProfile.id} 
                        onEditEntry={handleEditClick}
                    />
                </div>
            )}

            {!isLoading && activeTab === 'master' && (
                <div className="space-y-4">
                    <div className="flex gap-4 p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg items-center">
                        <div className="flex rounded-md shadow-sm bg-white dark:bg-slate-900">
                            <button onClick={() => { setMasterViewMode('class'); setMasterFilterId(null); }} className={`px-4 py-2 text-sm rounded-l-md border ${masterViewMode === 'class' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-600 border-slate-200'}`}>By Class</button>
                            <button onClick={() => { setMasterViewMode('teacher'); setMasterFilterId(null); }} className={`px-4 py-2 text-sm rounded-r-md border-t border-b border-r ${masterViewMode === 'teacher' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-600 border-slate-200'}`}>By Teacher</button>
                        </div>
                        
                        <div className="flex-grow max-w-md">
                             {masterViewMode === 'class' ? (
                                <select value={masterFilterId || ''} onChange={e => setMasterFilterId(Number(e.target.value))} className="w-full p-2 rounded border">
                                    <option value="">Select Class...</option>
                                    {academicClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                             ) : (
                                 <SearchableSelect 
                                    options={users.filter(u => ['Teacher', 'Team Lead'].includes(u.role)).map(u => ({ value: u.id, label: u.name }))}
                                    value={masterFilterId as string}
                                    onChange={(val) => setMasterFilterId(val as string | number)}
                                    placeholder="Select Teacher..."
                                 />
                             )}
                        </div>
                    </div>
                    
                    <TimetableGrid 
                        entries={entries} 
                        periods={periods} 
                        viewMode={masterViewMode} 
                        filterId={masterFilterId} 
                        onEditEntry={handleEditClick}
                    />
                </div>
            )}

            {entryModalOpen && selectedSlot && (
                <EntryModal 
                    isOpen={entryModalOpen}
                    onClose={() => { setEntryModalOpen(false); setSelectedSlot(null); }}
                    onSave={handleSaveEntry}
                    onDelete={handleDeleteEntry}
                    day={selectedSlot.day}
                    period={selectedSlot.period}
                    initialData={selectedSlot.entry}
                    academicClasses={academicClasses}
                    subjects={subjects}
                    users={users}
                    locations={locations}
                    fixedTeacherId={activeTab === 'my_timetable' ? userProfile.id : undefined}
                    existingEntries={entries}
                />
            )}
        </div>
    );
};

export default TimetableView;
