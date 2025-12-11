
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Campus, AcademicTeachingAssignment, TeacherShift } from '../types';
import Spinner from './common/Spinner';
import { todayISO } from '../services/checkins';
import Pagination from './common/Pagination';

interface DailyAttendanceRow {
    teacher_id: string;
    teacher_name: string;
    teacher_role: string;
    campus_name: string;
    status: string | null;
    checkin_time: string | null;
    checkout_time: string | null;
    notes: string | null;
    photo_url: string | null;
    is_late: boolean;
    on_time: boolean;
}

interface TeacherAttendanceDashboardProps {
    campuses: Campus[];
    academicAssignments: AcademicTeachingAssignment[];
}

const TeacherAttendanceDashboard: React.FC<TeacherAttendanceDashboardProps> = ({ campuses, academicAssignments }) => {
    const [date, setDate] = useState(todayISO());
    const [campusId, setCampusId] = useState<number | ''>('');
    const [attendanceData, setAttendanceData] = useState<DailyAttendanceRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [teacherShifts, setTeacherShifts] = useState<TeacherShift[]>([]);
    
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [nameSearch, setNameSearch] = useState<string>('');
    const [assignmentFilter, setAssignmentFilter] = useState<string>('');
    
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;
    
    // Photo modal state
    const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);

    // Fetch shifts to calculate early checkout
    useEffect(() => {
        const fetchShifts = async () => {
            const { data } = await supabase.from('teacher_shifts').select('*');
            if(data) setTeacherShifts(data);
        };
        fetchShifts();
    }, []);

    useEffect(() => {
        const fetchAttendance = async () => {
            setIsLoading(true);
            const { data, error } = await supabase.rpc('get_daily_teacher_attendance', {
                p_date: date,
                p_campus_id: campusId === '' ? null : campusId
            });

            if (error) {
                console.error("Failed to fetch attendance:", error);
                setAttendanceData([]);
            } else {
                setAttendanceData(data || []);
            }
            setIsLoading(false);
        };
        fetchAttendance();
    }, [date, campusId]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, nameSearch, assignmentFilter]);

    const assignmentOptions = useMemo(() => {
        const uniqueAssignments = new Map<string, boolean>();
        academicAssignments.forEach(a => {
            if (a.subject_name && a.academic_class?.name) {
                const key = `${a.subject_name} - ${a.academic_class.name}`;
                if (!uniqueAssignments.has(key)) {
                    uniqueAssignments.set(key, true);
                }
            }
        });
        return Array.from(uniqueAssignments.keys()).sort();
    }, [academicAssignments]);

    const filteredAttendanceData = useMemo(() => {
        let data = attendanceData;

        if (statusFilter) {
            data = data.filter(row => row.status === statusFilter);
        }

        if (nameSearch) {
            data = data.filter(row => row.teacher_name.toLowerCase().includes(nameSearch.toLowerCase()));
        }

        if (assignmentFilter) {
            const teacherIdsForAssignment = new Set(
                academicAssignments
                    .filter(a => {
                        const assignmentKey = `${a.subject_name} - ${a.academic_class?.name}`;
                        return assignmentKey === assignmentFilter;
                    })
                    .map(a => a.teacher_user_id)
            );
            data = data.filter(row => teacherIdsForAssignment.has(row.teacher_id));
        }

        return data;
    }, [attendanceData, statusFilter, nameSearch, assignmentFilter, academicAssignments]);

    const totalPages = Math.ceil(filteredAttendanceData.length / ITEMS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAttendanceData.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAttendanceData, currentPage]);


    const getStatusChip = (status: string | null) => {
        if (!status) return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">Not Recorded</span>;
        switch (status) {
            case 'Present': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 border border-green-200">Present</span>;
            case 'Late': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Late</span>;
            case 'Absent': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 border border-red-200">Absent</span>;
            case 'Remote': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">Remote</span>;
            default: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-200 text-slate-700">{status}</span>;
        }
    };
    
    const getShiftInfo = (teacherId: string) => {
        const dayOfWeek = new Date(date).getDay();
        return teacherShifts.find(s => s.teacher_id === teacherId && s.day_of_week === dayOfWeek);
    }

    const checkEarlyLeave = (checkoutTimeStr: string | null, teacherId: string) => {
        if (!checkoutTimeStr) return false;
        const shift = getShiftInfo(teacherId);
        if (!shift || !shift.end_time) return false;
        
        const checkoutTime = new Date(checkoutTimeStr);
        const [endHour, endMinute] = shift.end_time.split(':').map(Number);
        
        // Create shift end date object for same day
        const shiftEnd = new Date(checkoutTime);
        shiftEnd.setHours(endHour, endMinute, 0, 0);
        
        // Strict comparison: checkout must be >= shift end time
        return checkoutTime < shiftEnd;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Teacher Attendance</h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Monitor daily staff check-ins, lateness, and early departures.</p>
            </div>

            <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40 flex flex-col md:flex-row gap-4 flex-wrap items-center">
                <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="p-2 rounded-md bg-transparent border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <select
                    value={campusId}
                    onChange={e => setCampusId(e.target.value ? Number(e.target.value) : '')}
                    className="p-2 rounded-md bg-transparent border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                    <option value="">All Campuses</option>
                    {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                 <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="p-2 rounded-md bg-transparent border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                    <option value="">All Statuses</option>
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Absent">Absent</option>
                    <option value="Remote">Remote</option>
                </select>
                 <select
                    value={assignmentFilter}
                    onChange={e => setAssignmentFilter(e.target.value)}
                    className="p-2 rounded-md bg-transparent border border-slate-300 dark:border-slate-700 max-w-xs text-slate-900 dark:text-white"
                >
                    <option value="">All Assignments</option>
                    {assignmentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                 <input
                    type="text"
                    placeholder="Search by name..."
                    value={nameSearch}
                    onChange={e => setNameSearch(e.target.value)}
                    className="p-2 rounded-md bg-transparent border border-slate-300 dark:border-slate-700 flex-grow text-slate-900 dark:text-white"
                />
            </div>

            <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                        <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-500/10">
                            <tr>
                                <th className="px-6 py-3">Teacher</th>
                                <th className="px-6 py-3">Shift</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Check In</th>
                                <th className="px-6 py-3">Check Out</th>
                                <th className="px-6 py-3">Notes/Photo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center">
                                        <Spinner size="lg" />
                                    </td>
                                </tr>
                            ) : paginatedData.length > 0 ? (
                                paginatedData.map((row, index) => {
                                    const shift = getShiftInfo(row.teacher_id);
                                    const isEarly = checkEarlyLeave(row.checkout_time, row.teacher_id);
                                    
                                    return (
                                    <tr key={index} className="border-b border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-500/10">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-900 dark:text-white">{row.teacher_name}</p>
                                            <p className="text-xs text-slate-500">{row.teacher_role} • {row.campus_name}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {shift ? (
                                                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                    {shift.start_time.slice(0,5)} - {shift.end_time.slice(0,5)}
                                                </span>
                                            ) : <span className="text-xs text-slate-400">No Shift</span>}
                                        </td>
                                        <td className="px-6 py-4">{getStatusChip(row.status)}</td>
                                        <td className="px-6 py-4">
                                            {row.checkin_time ? (
                                                <div>
                                                    <p className="font-mono text-slate-900 dark:text-white">{new Date(row.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    {row.is_late && <span className="text-[10px] font-bold text-red-600 uppercase">LATE ARRIVAL</span>}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {row.checkout_time ? (
                                                <div>
                                                    <p className="font-mono text-slate-900 dark:text-white">{new Date(row.checkout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    {isEarly && <span className="text-[10px] font-bold text-orange-600 uppercase bg-orange-100 px-1 rounded">EARLY LEAVE</span>}
                                                </div>
                                            ) : (
                                                row.checkin_time ? <span className="text-xs text-slate-400 italic">Active</span> : '-'
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {row.notes && <p className="text-xs italic mb-1 max-w-[150px] truncate" title={row.notes}>"{row.notes}"</p>}
                                            {row.photo_url && (
                                                <button
                                                    onClick={() => setPhotoModalUrl(row.photo_url)}
                                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                >
                                                    <span>📷 View Photo</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )})
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        No records found for this selection.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                    <Pagination 
                        currentPage={currentPage} 
                        totalPages={totalPages} 
                        onPageChange={setCurrentPage} 
                        itemsPerPage={ITEMS_PER_PAGE}
                        totalItems={filteredAttendanceData.length}
                    />
                </div>
            </div>
            
            {/* Photo Modal */}
            {photoModalUrl && (
                <div 
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setPhotoModalUrl(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <button
                            onClick={() => setPhotoModalUrl(null)}
                            className="absolute -top-10 right-0 text-white hover:text-slate-300 text-2xl font-bold"
                        >
                            ✕
                        </button>
                        <img 
                            src={photoModalUrl} 
                            alt="Check-in photo" 
                            className="max-w-full max-h-[85vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherAttendanceDashboard;
