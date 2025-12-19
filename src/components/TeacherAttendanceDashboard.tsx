
import React, { useState, useEffect, useMemo } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { Campus, AcademicTeachingAssignment, TeacherShift } from '../types';
import Spinner from './common/Spinner';
import { todayISO } from '../services/checkins';
import Pagination from './common/Pagination';
import { DownloadIcon, TrendingUpIcon, TrendingDownIcon } from './common/icons';
import { exportToCsv } from '../utils/export';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from 'recharts';

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

interface CampusTrendData {
    campus_name: string;
    present: number;
    late: number;
    absent: number;
    remote: number;
    total: number;
    on_time_rate: number;
    early_birds: number;
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
    
    // Time constants for badge calculations
    const EARLY_ARRIVAL_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes before shift
    const GRACE_PERIOD_MS = 60 * 1000; // 1 minute grace period
    
    // Photo modal state
    const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);
    
    // Show/hide campus trends section
    const [showTrends, setShowTrends] = useState(false);

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

    // Check if a teacher arrived early (before shift start time)
    const checkEarlyArrival = (checkinTimeStr: string | null, teacherId: string) => {
        if (!checkinTimeStr) return false;
        const shift = getShiftInfo(teacherId);
        if (!shift || !shift.start_time) return false;
        
        const checkinTime = new Date(checkinTimeStr);
        const [startHour, startMinute] = shift.start_time.split(':').map(Number);
        
        // Create shift start date object for same day
        const shiftStart = new Date(checkinTime);
        shiftStart.setHours(startHour, startMinute, 0, 0);
        
        // Early if check-in is before shift start minus threshold plus grace period
        return checkinTime.getTime() < shiftStart.getTime() - EARLY_ARRIVAL_THRESHOLD_MS + GRACE_PERIOD_MS;
    };

    // Calculate campus-based trends
    const campusTrends = useMemo((): CampusTrendData[] => {
        const trendMap = new Map<string, CampusTrendData>();
        
        attendanceData.forEach(row => {
            const campusName = row.campus_name || 'No Campus';
            if (!trendMap.has(campusName)) {
                trendMap.set(campusName, {
                    campus_name: campusName,
                    present: 0,
                    late: 0,
                    absent: 0,
                    remote: 0,
                    total: 0,
                    on_time_rate: 0,
                    early_birds: 0
                });
            }
            
            const trend = trendMap.get(campusName)!;
            trend.total++;
            
            if (row.status === 'Present') trend.present++;
            else if (row.status === 'Late') trend.late++;
            else if (row.status === 'Absent') trend.absent++;
            else if (row.status === 'Remote') trend.remote++;
            
            if (row.on_time) trend.on_time_rate++;
            
            // Check for early birds
            if (checkEarlyArrival(row.checkin_time, row.teacher_id)) {
                trend.early_birds++;
            }
        });
        
        // Calculate percentages
        trendMap.forEach(trend => {
            trend.on_time_rate = trend.total > 0 
                ? Math.round((trend.on_time_rate / trend.total) * 100) 
                : 0;
        });
        
        return Array.from(trendMap.values()).sort((a, b) => b.total - a.total);
    }, [attendanceData, teacherShifts]);

    // Export function
    const handleExportAttendance = () => {
        if (filteredAttendanceData.length === 0) return;
        
        const exportData = filteredAttendanceData.map(row => {
            const shift = getShiftInfo(row.teacher_id);
            const isEarlyBird = checkEarlyArrival(row.checkin_time, row.teacher_id);
            const isEarlyLeave = checkEarlyLeave(row.checkout_time, row.teacher_id);
            
            return {
                'Teacher Name': row.teacher_name,
                'Role': row.teacher_role,
                'Campus': row.campus_name,
                'Status': row.status || 'Not Recorded',
                'Shift Start': shift?.start_time?.slice(0, 5) || 'N/A',
                'Shift End': shift?.end_time?.slice(0, 5) || 'N/A',
                'Check In': row.checkin_time 
                    ? new Date(row.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : '-',
                'Check Out': row.checkout_time 
                    ? new Date(row.checkout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : '-',
                'On Time': row.on_time ? 'Yes' : 'No',
                'Late Arrival': row.is_late ? 'Yes' : 'No',
                'Early Bird': isEarlyBird ? 'Yes' : 'No',
                'Early Leave': isEarlyLeave ? 'Yes' : 'No',
                'Notes': row.notes || ''
            };
        });
        
        exportToCsv(exportData, `teacher_attendance_${date}.csv`);
    };

    // Badge colors
    const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Teacher Attendance</h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Monitor daily staff check-ins, lateness, and early departures.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowTrends(!showTrends)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            showTrends 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <TrendingUpIcon className="w-4 h-4" />
                        {showTrends ? 'Hide Trends' : 'Campus Trends'}
                    </button>
                    <button
                        onClick={handleExportAttendance}
                        disabled={filteredAttendanceData.length === 0}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Campus Trends Section */}
            {showTrends && campusTrends.length > 0 && (
                <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">📊 Campus Attendance Trends</h2>
                    
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {campusTrends.slice(0, 4).map((trend, index) => (
                            <div key={index} className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-slate-900 dark:text-white truncate" title={trend.campus_name}>
                                        {trend.campus_name}
                                    </h3>
                                    {trend.on_time_rate >= 80 ? (
                                        <TrendingUpIcon className="w-5 h-5 text-green-500" />
                                    ) : trend.on_time_rate >= 50 ? (
                                        <span className="text-yellow-500">—</span>
                                    ) : (
                                        <TrendingDownIcon className="w-5 h-5 text-red-500" />
                                    )}
                                </div>
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{trend.on_time_rate}%</div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">On-time rate</p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    <span className="px-2 py-0.5 text-[10px] rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                        {trend.present} Present
                                    </span>
                                    <span className="px-2 py-0.5 text-[10px] rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                                        {trend.late} Late
                                    </span>
                                    {trend.early_birds > 0 && (
                                        <span className="px-2 py-0.5 text-[10px] rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                            🌅 {trend.early_birds} Early Birds
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bar Chart */}
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={campusTrends} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis type="number" />
                                <YAxis dataKey="campus_name" type="category" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(255,255,255,0.95)', 
                                        borderRadius: '8px',
                                        border: '1px solid #e5e7eb'
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="present" name="Present" stackId="a" fill="#10b981" />
                                <Bar dataKey="late" name="Late" stackId="a" fill="#f59e0b" />
                                <Bar dataKey="absent" name="Absent" stackId="a" fill="#ef4444" />
                                <Bar dataKey="remote" name="Remote" stackId="a" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

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
                                <th className="px-6 py-3">Badges</th>
                                <th className="px-6 py-3">Notes/Photo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center">
                                        <Spinner size="lg" />
                                    </td>
                                </tr>
                            ) : paginatedData.length > 0 ? (
                                paginatedData.map((row, index) => {
                                    const shift = getShiftInfo(row.teacher_id);
                                    const isEarlyLeave = checkEarlyLeave(row.checkout_time, row.teacher_id);
                                    const isEarlyBird = checkEarlyArrival(row.checkin_time, row.teacher_id);
                                    const needsImprovement = row.is_late || isEarlyLeave;
                                    
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
                                                    {isEarlyLeave && <span className="text-[10px] font-bold text-orange-600 uppercase bg-orange-100 px-1 rounded">EARLY LEAVE</span>}
                                                </div>
                                            ) : (
                                                row.checkin_time ? <span className="text-xs text-slate-400 italic">Active</span> : '-'
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {/* Early Bird Badge */}
                                                {isEarlyBird && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900 shadow-sm" title="Arrived early for work">
                                                        🌅 Early Bird
                                                    </span>
                                                )}
                                                {/* Do Better Badge */}
                                                {needsImprovement && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-full bg-gradient-to-r from-red-100 to-orange-100 text-red-700 border border-red-200" title="Needs improvement - late arrival or early departure">
                                                        📈 Do Better
                                                    </span>
                                                )}
                                                {/* On Time Badge */}
                                                {row.on_time && !isEarlyBird && !needsImprovement && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-full bg-green-100 text-green-700" title="Arrived on time">
                                                        ✓ On Time
                                                    </span>
                                                )}
                                            </div>
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
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
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
