
import React, { useState, useMemo } from 'react';
import type { AttendanceRecord, ClassGroupMember } from '../types';
import { AttendanceStatus } from '../types';
import { ClockIcon, DownloadIcon, BellIcon } from './common/icons';
import Spinner from './common/Spinner';
import { exportToCsv } from '../utils/export';
import { bulkSendSmsNotifications } from '../services/smsService';
import { supabase } from '../services/supabaseClient';

interface Props {
    members: ClassGroupMember[];
    onSaveRecord: (record: Partial<AttendanceRecord> & { member_id: number; session_date: string; schedule_id: number; id?: number }) => Promise<boolean>;
}

const SubjectTeacherAttendance: React.FC<Props> = ({ members, onSaveRecord }) => {
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    const [isNotifying, setIsNotifying] = useState(false);

    const dayOfWeekForAttendance = new Date(attendanceDate + 'T12:00:00').getDay();
    
    const scheduledToday = useMemo(() => {
        return members.map(member => ({
            member,
            schedule: (member.schedules || []).find(s => s.day_of_week === dayOfWeekForAttendance)
        })).filter(item => !!item.schedule);
    }, [members, dayOfWeekForAttendance]);

    const handleMarkAttendance = (memberId: number, scheduleId: number, status: AttendanceStatus) => {
        const member = members.find(m => m.id === memberId);
        const existingRecord = (member?.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === scheduleId);
        
        onSaveRecord({
            id: existingRecord?.id,
            member_id: memberId,
            schedule_id: scheduleId,
            session_date: attendanceDate,
            status,
        });
    };

    const handleExportReport = () => {
        // Collect all records for all members, regardless of day, to build a comprehensive view?
        // Or just for the current day/view? 
        // Usually "Export" implies historical data. Let's export comprehensive history for these members.

        // 1. Identify all unique Date+Schedule combinations
        const columnKeys = new Set<string>();
        const keyMap = new Map<string, { date: string, time: string }>();

        members.forEach(m => {
            (m.records || []).forEach(r => {
                if (r.schedule_id) {
                    // Try to find the schedule time
                    const schedule = (m.schedules || []).find(s => s.id === r.schedule_id);
                    const timeLabel = schedule ? `(${schedule.start_time.slice(0,5)})` : '(Unknown Time)';
                    const uniqueKey = `${r.session_date} ${timeLabel}`;
                    columnKeys.add(uniqueKey);
                    keyMap.set(uniqueKey, { date: r.session_date, time: timeLabel });
                }
            });
        });

        const sortedKeys = Array.from(columnKeys).sort();

        const csvData = members.map(member => {
            const row: any = {
                'Student Name': member.student_name,
            };

            let present = 0;
            let absent = 0;
            let late = 0;

            sortedKeys.forEach(key => {
                const { date } = keyMap.get(key)!;
                // We assume records is flat. We need to match date and schedule time implicitly via schedule_id
                // This is tricky because schedule_id maps to a day of week.
                // We find the record that matches the date.
                const record = (member.records || []).find(r => {
                    if (r.session_date !== date) return false;
                    const schedule = (member.schedules || []).find(s => s.id === r.schedule_id);
                    const timeLabel = schedule ? `(${schedule.start_time.slice(0,5)})` : '(Unknown Time)';
                    return `${r.session_date} ${timeLabel}` === key;
                });

                const status = record ? record.status : '-';
                row[key] = status;

                if (status === AttendanceStatus.Present) present++;
                if (status === AttendanceStatus.Absent) absent++;
                if (status === AttendanceStatus.Late) late++;
            });

             // Summary columns
            row['Total Present'] = present;
            row['Total Absent'] = absent;
            row['Total Late'] = late;
            
            const totalRecorded = present + absent + late;
            row['Attendance %'] = totalRecorded > 0 
                ? Math.round(((present + late) / totalRecorded) * 100) + '%' 
                : '0%';

            return row;
        });

        exportToCsv(csvData, `subject_attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
    };
    
    // --- Bulk Actions ---

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedMemberIds(new Set(scheduledToday.map(item => item.member.id)));
        } else {
            setSelectedMemberIds(new Set());
        }
    };

    const handleSelectOne = (id: number) => {
        const newSet = new Set(selectedMemberIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedMemberIds(newSet);
    };

    const handleBulkMark = async (status: AttendanceStatus) => {
        if (selectedMemberIds.size === 0) return;
        setIsBulkSaving(true);
        
        const promises: Promise<boolean>[] = [];
        
        // We need to find the schedule ID for each selected member for *this specific day*
        scheduledToday.forEach(({ member, schedule }) => {
            if (selectedMemberIds.has(member.id) && schedule) {
                const record = (member.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === schedule.id);
                promises.push(onSaveRecord({
                    id: record?.id,
                    member_id: member.id,
                    session_date: attendanceDate,
                    status,
                    schedule_id: schedule.id,
                }));
            }
        });

        await Promise.all(promises);
        
        setIsBulkSaving(false);
        setSelectedMemberIds(new Set());
    };

    const handleBulkNotify = async (statuses: AttendanceStatus[]) => {
        setIsNotifying(true);
        try {
            // Get current user for sent_by
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('Not authenticated');
                return;
            }

            // Get user profile for school_id
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('school_id')
                .eq('id', user.id)
                .single();

            if (!profile) {
                alert('User profile not found');
                return;
            }

            // Collect students with selected statuses from today's schedule
            const studentsToNotify = scheduledToday
                .map(({ member, schedule }) => {
                    const record = (member.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === schedule!.id);
                    return { member, record, schedule };
                })
                .filter(({ record }) => record && statuses.includes(record.status));

            if (studentsToNotify.length === 0) {
                alert(`No students with status: ${statuses.join(' or ')}`);
                return;
            }

            // Get student details including phone numbers
            const studentIds = studentsToNotify.map(({ member }) => member.student_id);
            const { data: students } = await supabase
                .from('students')
                .select('id, name, parent_phone_number_1, parent_phone_number_2')
                .in('id', studentIds);

            if (!students || students.length === 0) {
                alert('No student details found');
                return;
            }

            // Prepare notifications
            const notifications = students
                .filter(s => s.parent_phone_number_1 || s.parent_phone_number_2)
                .flatMap(student => {
                    const item = studentsToNotify.find(({ member }) => member.student_id === student.id);
                    
                    if (!item || !item.record) return [];

                    const templateName = 
                        item.record.status === AttendanceStatus.Absent ? 'subject_absentee' :
                        'subject_late';

                    const notificationType =
                        item.record.status === AttendanceStatus.Absent ? 'subject_absentee' :
                        'subject_late';

                    const variables = {
                        student_name: student.name,
                        date: new Date(attendanceDate).toLocaleDateString(),
                        subject: '',  // Would need to get this from context
                        class_name: ''  // Would need to get this from context
                    };

                    const phones = [student.parent_phone_number_1, student.parent_phone_number_2].filter(Boolean);

                    return phones.map(phone => ({
                        schoolId: profile.school_id,
                        studentId: student.id,
                        recipientPhone: phone!,
                        templateName,
                        variables,
                        notificationType: notificationType as any,
                        sentBy: user.id
                    }));
                });

            // Send notifications
            const result = await bulkSendSmsNotifications(notifications);
            
            alert(`Notifications sent: ${result.sent} successful, ${result.failed} failed`);
        } catch (error: any) {
            console.error('Error sending notifications:', error);
            alert('Failed to send notifications: ' + error.message);
        } finally {
            setIsNotifying(false);
        }
    };

    const isAllSelected = scheduledToday.length > 0 && selectedMemberIds.size === scheduledToday.length;

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <input 
                        type="date" 
                        value={attendanceDate} 
                        onChange={e => setAttendanceDate(e.target.value)} 
                        className="p-2 border rounded-md bg-transparent"
                    />
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleExportReport}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <DownloadIcon className="w-4 h-4" /> Export History
                    </button>
                    <button 
                        onClick={() => handleBulkNotify([AttendanceStatus.Absent, AttendanceStatus.Late])}
                        disabled={isNotifying}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                        title="Notify all parents of absent and late students for this class"
                    >
                        {isNotifying ? <Spinner size="sm" /> : <><BellIcon className="w-4 h-4" /> Notify Absent/Late</>}
                    </button>
                </div>
            </div>
            
             {scheduledToday.length > 0 ? (
                <>
                    {/* Bulk Action Bar */}
                    <div className="flex items-center justify-between p-3 bg-slate-200 dark:bg-slate-800 rounded-lg sticky top-0 z-10">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                            <input 
                                type="checkbox" 
                                checked={isAllSelected} 
                                onChange={handleSelectAll}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                            Select All ({scheduledToday.length})
                        </label>
                        
                        <div className="flex gap-2">
                            {selectedMemberIds.size > 0 && (
                                <>
                                    <span className="text-xs self-center text-slate-500 hidden sm:block">{selectedMemberIds.size} selected</span>
                                    <button 
                                        onClick={() => handleBulkMark(AttendanceStatus.Present)} 
                                        disabled={isBulkSaving}
                                        className="px-3 py-1 text-xs font-bold text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {isBulkSaving ? <Spinner size="sm"/> : 'Mark Present'}
                                    </button>
                                    <button 
                                        onClick={() => handleBulkMark(AttendanceStatus.Absent)} 
                                        disabled={isBulkSaving}
                                        className="px-3 py-1 text-xs font-bold text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                                    >
                                        Absent
                                    </button>
                                     <button 
                                        onClick={() => handleBulkMark(AttendanceStatus.Late)} 
                                        disabled={isBulkSaving}
                                        className="px-3 py-1 text-xs font-bold text-white bg-yellow-500 rounded hover:bg-yellow-600 disabled:opacity-50"
                                    >
                                        Late
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        {scheduledToday.map(({ member, schedule }) => {
                            if (!schedule) return null;
                            const record = (member.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === schedule.id);
                            const isSelected = selectedMemberIds.has(member.id);

                            return (
                                <div key={member.id} className={`p-3 rounded-lg flex justify-between items-center border ${isSelected ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700' : 'bg-slate-100 border-transparent dark:bg-slate-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected} 
                                            onChange={() => handleSelectOne(member.id)}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <p className="font-semibold">{member.student_name}</p>
                                            <p className="text-xs text-slate-500"><ClockIcon className="w-3 h-3 inline-block mr-1" />{schedule.start_time.substring(0,5)} - {schedule.end_time.substring(0,5)}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {(Object.values(AttendanceStatus) as AttendanceStatus[]).map(status => (
                                            <button 
                                                key={status} 
                                                onClick={() => handleMarkAttendance(member.id, schedule.id, status)} 
                                                className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors
                                                    ${record?.status === status 
                                                        ? (status === 'Present' ? 'bg-green-600 text-white' : status === 'Absent' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white')
                                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <p className="text-center text-slate-500 py-8">No students scheduled for this class on the selected day.</p>
            )}
        </div>
    );
};

export default SubjectTeacherAttendance;
