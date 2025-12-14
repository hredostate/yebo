import React, { useState, useMemo } from 'react';
import type { AttendanceRecord, ClassGroupMember } from '../types';
import { AttendanceStatus } from '../types';
import Spinner from './common/Spinner';
import { MicIcon, DownloadIcon, BellIcon } from './common/icons';
import { getAIClient } from '../services/aiClient';
import { textFromAI } from '../utils/ai';
import { extractAndParseJson } from '../utils/json';
import { exportToCsv } from '../utils/export';
import { sendSmsNotification } from '../services/smsService';

interface Props {
    members: ClassGroupMember[];
    onSaveRecord: (record: Partial<AttendanceRecord> & { member_id: number; session_date: string; id?: number }) => Promise<boolean>;
    schoolId: number;
    userId: string;
}

const ClassTeacherAttendance: React.FC<Props> = ({ members, onSaveRecord, schoolId, userId }) => {
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessingVoice, setIsProcessingVoice] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const [voiceConfirmation, setVoiceConfirmation] = useState<{ studentId: number, status: AttendanceStatus, studentName: string }[] | null>(null);
    const [notifyingParent, setNotifyingParent] = useState<number | null>(null);
    const [bulkNotifying, setBulkNotifying] = useState(false);

    const isPastDeadline = () => {
        const now = new Date();
        const deadline = new Date(attendanceDate);
        deadline.setHours(9, 0, 0, 0);
        return new Date(attendanceDate).toDateString() === now.toDateString() && now > deadline;
    };
    
    const dayOfWeek = new Date(attendanceDate + 'T12:00:00').getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const sortedMembers = useMemo(() => {
        return [...members].sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
    }, [members]);

    const handleMarkAttendance = async (memberId: number, status: AttendanceStatus) => {
        // Find existing record for this date to update it
        const member = members.find(m => m.id === memberId);
        const existingRecord = (member?.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === null);

        await onSaveRecord({
            id: existingRecord?.id,
            member_id: memberId,
            session_date: attendanceDate,
            status,
            schedule_id: null, // No specific schedule for daily roll call
        });
    };

    // --- Export Logic ---
    const handleExportReport = () => {
        if (members.length === 0) return;

        // 1. Collect all unique dates from all records
        const allDatesSet = new Set<string>();
        members.forEach(m => {
            (m.records || []).forEach(r => allDatesSet.add(r.session_date));
        });
        const sortedDates = Array.from(allDatesSet).sort();

        // 2. Build rows
        const csvData = members.map(member => {
            const row: any = {
                'Student Name': member.student_name,
            };

            let present = 0;
            let absent = 0;
            let late = 0;

            // Fill date columns
            sortedDates.forEach(date => {
                const record = (member.records || []).find(r => r.session_date === date);
                const status = record ? record.status : '-'; // '-' for not recorded/no school
                row[date] = status;

                if (status === AttendanceStatus.Present) present++;
                if (status === AttendanceStatus.Absent) absent++;
                if (status === AttendanceStatus.Late) late++;
            });

            // Summary columns
            row['Total Present'] = present;
            row['Total Absent'] = absent;
            row['Total Late'] = late;
            row['Attendance %'] = sortedDates.length > 0 
                ? Math.round(((present + late) / sortedDates.length) * 100) + '%' 
                : '0%';

            return row;
        });

        exportToCsv(csvData, `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
    };

    // --- Voice Logic ---
    
    const handleVoiceCommand = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Voice recognition is not supported in this browser. Please use Chrome.");
            return;
        }
        
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-NG'; // Optimizing for Nigerian English accent

        recognition.onstart = () => {
            setIsListening(true);
            setVoiceTranscript('');
            setVoiceConfirmation(null);
        };

        recognition.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript;
            setVoiceTranscript(transcript);
            setIsListening(false);
            await processVoiceTranscript(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
            alert(`Error listening: ${event.error}`);
        };
        
        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const processVoiceTranscript = async (transcript: string) => {
        setIsProcessingVoice(true);
        try {
            if (!aiClient) throw new Error("AI Client not available");

            const studentList = members.map(m => ({ id: m.id, name: m.student_name }));
            
            const prompt = `
            You are an attendance assistant. Map the spoken names in the transcript to the provided student list.
            Transcript: "${transcript}"
            
            Student List: ${JSON.stringify(studentList)}
            
            Rules:
            1. Match names loosely (fuzzy match).
            2. Identify status: 'Present', 'Absent', or 'Late'. Default to 'Present' if only name is mentioned in a positive context, but usually status is explicit.
            3. Ignore names that don't match.
            
            Return JSON object: { "updates": [{ "studentId": number, "status": "Present" | "Absent" | "Late" }] }
            `;

            const response = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            updates: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        studentId: { type: Type.NUMBER },
                                        status: { type: Type.STRING, enum: ['Present', 'Absent', 'Late'] }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const result = extractAndParseJson<{ updates: { studentId: number, status: AttendanceStatus }[] }>(textFromGemini(response));
            
            if (result && result.updates) {
                // Hydrate with names for confirmation
                const updatesWithNames = result.updates.map(u => {
                    const member = members.find(m => m.id === u.studentId);
                    return member ? { ...u, studentName: member.student_name || 'Unknown' } : null;
                }).filter(Boolean) as { studentId: number, status: AttendanceStatus, studentName: string }[];
                
                setVoiceConfirmation(updatesWithNames);
            } else {
                alert("Could not understand the attendance commands.");
            }

        } catch (error) {
            console.error("AI Processing Error:", error);
            alert("Failed to process voice command.");
        } finally {
            setIsProcessingVoice(false);
        }
    };

    const applyVoiceUpdates = async () => {
        if (!voiceConfirmation) return;
        setIsBulkSaving(true);
        const promises = voiceConfirmation.map(u => {
            const member = members.find(m => m.id === u.studentId);
            const record = (member?.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === null);
            return onSaveRecord({
                id: record?.id,
                member_id: u.studentId,
                session_date: attendanceDate,
                status: u.status,
                schedule_id: null,
            });
        });
        await Promise.all(promises);
        setIsBulkSaving(false);
        setVoiceConfirmation(null);
        setVoiceTranscript('');
    };

    // --- Bulk Actions ---

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedMemberIds(new Set(members.map(m => m.id)));
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
        
        const promises = Array.from(selectedMemberIds).map(id => {
            const member = members.find(m => m.id === id);
            const record = (member?.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === null);
            return onSaveRecord({
                id: record?.id,
                member_id: id,
                session_date: attendanceDate,
                status,
                schedule_id: null,
            });
        });

        await Promise.all(promises);
        
        setIsBulkSaving(false);
        setSelectedMemberIds(new Set()); // Clear selection after action
    };

    const isAllSelected = members.length > 0 && selectedMemberIds.size === members.length;
    
    // Notification functions
    const handleNotifyParent = async (member: ClassGroupMember, status: AttendanceStatus) => {
        const parentPhone = (member as any).student?.parent_phone_number_1;
        if (!parentPhone) {
            alert('No parent phone number available');
            return;
        }

        setNotifyingParent(member.id);
        try {
            const templateName = status === 'Present' ? 'attendance_present' : 
                                status === 'Absent' ? 'absentee_alert' : 'late_arrival';
            const notificationType = status === 'Present' ? 'attendance_present' : 
                                    status === 'Absent' ? 'absentee_alert' : 'late_arrival';

            const success = await sendSmsNotification({
                schoolId,
                studentId: (member as any).student_id || 0,
                recipientPhone: parentPhone,
                templateName,
                variables: {
                    student_name: member.student_name || '',
                    date: new Date(attendanceDate).toLocaleDateString(),
                    time: new Date().toLocaleTimeString(),
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

        for (const member of members) {
            const record = (member.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === null);
            const status = record?.status;
            
            if (status === 'Absent' || status === 'Late') {
                const parentPhone = (member as any).student?.parent_phone_number_1;
                if (!parentPhone) {
                    failed++;
                    continue;
                }

                try {
                    const templateName = status === 'Absent' ? 'absentee_alert' : 'late_arrival';
                    const notificationType = status === 'Absent' ? 'absentee_alert' : 'late_arrival';

                    const success = await sendSmsNotification({
                        schoolId,
                        studentId: (member as any).student_id || 0,
                        recipientPhone: parentPhone,
                        templateName,
                        variables: {
                            student_name: member.student_name || '',
                            date: new Date(attendanceDate).toLocaleDateString(),
                            time: new Date().toLocaleTimeString(),
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
    
    return (
        <div className="space-y-4 animate-fade-in relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div className="flex items-center gap-4">
                    <input 
                        type="date" 
                        value={attendanceDate} 
                        onChange={e => setAttendanceDate(e.target.value)} 
                        className="p-2 border rounded-md bg-transparent"
                    />
                    {isPastDeadline() && !isWeekend && (
                        <div className="px-3 py-1 text-sm font-semibold text-red-800 bg-red-100 rounded-full">
                            Past 9 AM Deadline
                        </div>
                    )}
                </div>
                <button 
                    onClick={handleExportReport}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    <DownloadIcon className="w-4 h-4" /> Export Report
                </button>
            </div>

            {isWeekend ? (
                 <div className="text-center text-slate-500 py-16">
                    <p>Attendance is not recorded on weekends.</p>
                </div>
            ) : (
                <>
                    {/* Bulk Action Bar */}
                    <div className="flex items-center justify-between p-3 bg-slate-200 dark:bg-slate-800 rounded-lg sticky top-0 z-10 shadow-sm">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                                <input 
                                    type="checkbox" 
                                    checked={isAllSelected} 
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                />
                                Select All
                            </label>
                            
                            <button 
                                onClick={handleVoiceCommand}
                                disabled={isListening || isProcessingVoice}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white rounded-lg transition-all ${isListening ? 'bg-red-500 animate-pulse' : 'bg-purple-600 hover:bg-purple-700'}`}
                                title="Click to speak attendance (e.g., 'Mark John Present')"
                            >
                                <MicIcon className="w-4 h-4" />
                                {isListening ? 'Listening...' : 'Voice Mode'}
                            </button>
                        </div>
                        
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

                    {/* Voice Confirmation Overlay */}
                    {(isProcessingVoice || voiceConfirmation) && (
                        <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg animate-fade-in">
                            {isProcessingVoice && (
                                <div className="flex items-center gap-3 text-purple-800 dark:text-purple-200">
                                    <Spinner size="sm" />
                                    <span>AI is analyzing your voice command...</span>
                                </div>
                            )}
                            {voiceConfirmation && (
                                <div>
                                    <p className="font-bold text-sm text-purple-900 dark:text-purple-100 mb-2">Confirm Attendance Updates:</p>
                                    <ul className="space-y-1 mb-3 max-h-40 overflow-y-auto">
                                        {voiceConfirmation.map((u, i) => (
                                            <li key={i} className="text-sm flex justify-between px-2 py-1 bg-white dark:bg-slate-800 rounded border border-purple-100 dark:border-slate-700">
                                                <span>{u.studentName}</span>
                                                <span className={`font-bold ${u.status === 'Present' ? 'text-green-600' : u.status === 'Absent' ? 'text-red-600' : 'text-yellow-600'}`}>{u.status}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setVoiceConfirmation(null)} className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300">Cancel</button>
                                        <button onClick={applyVoiceUpdates} className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">Apply Updates</button>
                                    </div>
                                </div>
                            )}
                             {voiceTranscript && !isProcessingVoice && !voiceConfirmation && <p className="text-xs italic text-slate-500 mt-1">Heard: "{voiceTranscript}"</p>}
                        </div>
                    )}

                    <div className="space-y-2">
                        {sortedMembers.map(member => {
                            const record = (member.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === null);
                            const isSelected = selectedMemberIds.has(member.id);
                            const canNotify = record?.status && ['Present', 'Absent', 'Late'].includes(record.status);

                            return (
                                <div key={member.id} className={`p-3 rounded-lg flex flex-col gap-2 border transition-colors ${isSelected ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700' : 'bg-slate-100 border-transparent dark:bg-slate-800'}`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected} 
                                                onChange={() => handleSelectOne(member.id)}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <p className="font-semibold">{member.student_name}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {(Object.values(AttendanceStatus) as AttendanceStatus[]).map(status => (
                                                <button 
                                                    key={status} 
                                                    onClick={() => handleMarkAttendance(member.id, status)} 
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
                                                onClick={() => handleNotifyParent(member, record.status as AttendanceStatus)}
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
            )}
        </div>
    );
};

export default ClassTeacherAttendance;
