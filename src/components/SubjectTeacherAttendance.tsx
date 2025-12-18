import React, { useState, useMemo } from 'react';
import type { AttendanceRecord, ClassGroupMember } from '../types';
import { AttendanceStatus } from '../types';
import { ClockIcon, DownloadIcon, BellIcon } from './common/icons';
import Spinner from './common/Spinner';
import { exportToCsv } from '../utils/export';
import { sendSmsNotification } from '../services/smsService';

interface Props {
    members: ClassGroupMember[];
    onSaveRecord: (record: Partial<AttendanceRecord> & { member_id: number; session_date: string; schedule_id: number; id?: number }) => Promise<boolean>;
    schoolId: number;
    userId: string;
}

const SubjectTeacherAttendance: React.FC<Props> = ({ members, onSaveRecord, schoolId, userId }) => {
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    const [notifyingParent, setNotifyingParent] = useState<number | null>(null);
    const [bulkNotifying, setBulkNotifying] = useState(false);

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

    // Notification functions (Subject Teachers don't notify for Present, only Absent/Late)
    const handleNotifyParent = async (member: ClassGroupMember, status: AttendanceStatus, schedule: any) => {
        const parentPhone = (member as any).student?.parent_phone_number_1;
        if (!parentPhone) {
            alert('No parent phone number available');
            return;
        }

        setNotifyingParent(member.id);
        try {
            const templateName = status === 'Absent' ? 'subject_absentee' : 'subject_late';
            const notificationType = status === 'Absent' ? 'subject_absentee' : 'subject_late';

            const success = await sendSmsNotification({
                schoolId,
                studentId: (member as any).student_id || 0,
                recipientPhone: parentPhone,
                templateName,
                variables: {
                    student_name: member.student_name || '',
                    date: new Date(attendanceDate).toLocaleDateString(),
                    subject: (schedule as any)?.subject_name || 'Class',
                    class_name: (member as any).class_name || ''
                },
                notificationType,
                sentBy: userId
            });

            if (success) {
                alert('Parent notified successfully');
            } else {
                alert('Failed to notify parent');
            }
        } catch (error) {
            console.error('Error notifying parent:', error);
            alert('Failed to notify parent');
        } finally {
            setNotifyingParent(null);
        }
    };

    const handleBulkNotifyAbsentLate = async () => {
        setBulkNotifying(true);
        let notified = 0;
        let failed = 0;

        for (const { member, schedule } of scheduledToday) {
            const record = (member.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === schedule?.id);
            const status = record?.status;
            
            if (status === 'Absent' || status === 'Late') {
                const parentPhone = (member as any).student?.parent_phone_number_1;
                if (!parentPhone) {
                    failed++;
                    continue;
                }

                try {
                    const templateName = status === 'Absent' ? 'subject_absentee' : 'subject_late';
                    const notificationType = status === 'Absent' ? 'subject_absentee' : 'subject_late';

                    const success = await sendSmsNotification({
                        schoolId,
                        studentId: (member as any).student_id || 0,
                        recipientPhone: parentPhone,
                        templateName,
                        variables: {
                            student_name: member.student_name || '',
                            date: new Date(attendanceDate).toLocaleDateString(),
                            subject: (schedule as any)?.subject_name || 'Class',
                            class_name: (member as any).class_name || ''
                        },
                        notificationType,
                        sentBy: userId
                    });

                    if (success) {
                        notified++;
                    } else {
                        failed++;
                    }

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error('Error notifying parent:', error);
                    failed++;
                }
            }
        }

        setBulkNotifying(false);
        alert(`Notified ${notified} parents. ${failed > 0 ? `Failed: ${failed}` : ''}`);
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
                        onClick={handleBulkNotifyAbsentLate}
                        disabled={bulkNotifying}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                        title="Notify all parents of absent and late students for this class"
                    >
                        {bulkNotifying ? <Spinner size="sm" /> : <><BellIcon className="w-4 h-4" /> Notify Absent/Late</>}
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
                            <button
                                onClick={handleBulkNotifyAbsentLate}
                                disabled={bulkNotifying}
                                className="flex items-center gap-1 px-3 py-1 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
                            >
                                {bulkNotifying ? (
                                    <Spinner size="xs" />
                                ) : (
                                    <BellIcon className="h-3 w-3" />
                                )}
                                Notify Absent/Late
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {scheduledToday.map(({ member, schedule }) => {
                            if (!schedule) return null;
                            const record = (member.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === schedule.id);
                            const isSelected = selectedMemberIds.has(member.id);
                            // Subject Teachers only notify for Absent and Late, NOT Present
                            const canNotify = record?.status && ['Absent', 'Late'].includes(record.status);

                            return (
                                <div key={member.id} className={`p-3 rounded-lg flex flex-col gap-2 border ${isSelected ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700' : 'bg-slate-100 border-transparent dark:bg-slate-800'}`}>
                                    <div className="flex justify-between items-center">
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
                                    {canNotify && (
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => handleNotifyParent(member, record.status as AttendanceStatus, schedule)}
                                                disabled={notifyingParent === member.id}
                                                className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
                                            >
                                                {notifyingParent === member.id ? (
                                                    <Spinner size="xs" />
                                                ) : (
                                                    <BellIcon className="h-3 w-3" />
                                                )}
                                                Notify Parent
                                            </button>
                                        </div>
                                    )}
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
