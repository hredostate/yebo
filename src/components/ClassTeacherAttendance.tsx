import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { AttendanceRecord, AttendanceOverride, ClassGroupMember, Term } from '../types';
import { AttendanceStatus } from '../types';
import Spinner from './common/Spinner';
import { MicIcon, DownloadIcon, BellIcon } from './common/icons';
import { getAIClient } from '../services/aiClient';
import { textFromAI } from '../utils/ai';
import { extractAndParseJson } from '../utils/json';
import { exportToCsv } from '../utils/export';
import { bulkSendSmsNotifications } from '../services/smsService';
import { requireSupabaseClient } from '../services/supabaseClient';

interface OverrideRow {
    studentId: number;
    studentName?: string;
    computedPresent: number;
    computedTotal: number;
    overridePresent?: number;
    overrideTotal?: number;
    comment?: string;
    overrideId?: number;
    updatedAt?: string | null;
    updatedBy?: string | null;
    enabled: boolean;
}

interface ManualOverrideProps {
    members: ClassGroupMember[];
    groupId: number;
    groupName: string;
    teacherId?: string | null;
    canOverride: boolean;
    schoolId: number;
    userId: string;
}

const ManualAttendanceOverridePanel: React.FC<ManualOverrideProps> = ({
    members,
    groupId,
    groupName,
    teacherId,
    canOverride,
    schoolId,
    userId,
}) => {
    const [terms, setTerms] = useState<Term[]>([]);
    const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
    const [rows, setRows] = useState<Record<number, OverrideRow>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedTerm = terms.find(t => t.id === selectedTermId) || null;
    const memberLookup = useMemo(() => {
        const lookup = new Map<number, ClassGroupMember>();
        members.forEach(m => lookup.set(m.id, m));
        return lookup;
    }, [members]);

    const loadAttendanceForTerm = useCallback(async (termId: number) => {
        if (!termId) return;
        const memberIds = members.map(m => m.id);
        if (memberIds.length === 0) {
            setRows({});
            return;
        }

        const supabase = requireSupabaseClient();
        setIsLoading(true);
        setError(null);

        try {
            const { data: termData, error: termError } = await supabase
                .from('terms')
                .select('id, term_label, session_label, start_date, end_date')
                .eq('id', termId)
                .maybeSingle();

            if (termError) throw termError;
            if (!termData) throw new Error('Term not found');

            const { data: overrideData, error: overrideError } = await supabase
                .from('attendance_overrides')
                .select('*')
                .eq('class_group_id', groupId)
                .eq('term_id', termId);

            if (overrideError) throw overrideError;

            let attendanceQuery = supabase
                .from('attendance_records')
                .select('member_id, status, session_date')
                .in('member_id', memberIds);

            if (termData.start_date) {
                attendanceQuery = attendanceQuery.gte('session_date', termData.start_date);
            }
            if (termData.end_date) {
                attendanceQuery = attendanceQuery.lte('session_date', termData.end_date);
            }

            const { data: attendanceData, error: attendanceError } = await attendanceQuery;
            if (attendanceError) throw attendanceError;

            const computedByStudent = new Map<number, { present: number; total: number }>();

            (attendanceData || []).forEach(record => {
                const member = memberLookup.get(record.member_id);
                if (!member) return;

                const studentId = (member as any).student_id as number | undefined;
                if (!studentId) return;

                const current = computedByStudent.get(studentId) || { present: 0, total: 0 };
                const status = (record.status || '').toLowerCase();
                const isPresent = status === 'present' || status === 'p';

                current.total += 1;
                if (isPresent) current.present += 1;
                computedByStudent.set(studentId, current);
            });

            const overridesByStudent = new Map<number, AttendanceOverride>();
            (overrideData || []).forEach(ovr => overridesByStudent.set(ovr.student_id, ovr as AttendanceOverride));

            const nextRows: Record<number, OverrideRow> = {};
            members.forEach(member => {
                const studentId = (member as any).student_id as number | undefined;
                if (!studentId) return;
                const computed = computedByStudent.get(studentId) || { present: 0, total: 0 };
                const override = overridesByStudent.get(studentId);

                nextRows[studentId] = {
                    studentId,
                    studentName: member.student_name,
                    computedPresent: computed.present,
                    computedTotal: computed.total,
                    overridePresent: override?.days_present,
                    overrideTotal: override?.total_days,
                    comment: override?.comment || '',
                    overrideId: override?.id,
                    updatedAt: override?.updated_at,
                    updatedBy: override?.updated_by,
                    enabled: !!override,
                };
            });

            setRows(nextRows);
        } catch (err: any) {
            console.error('Error loading attendance overrides', err);
            setError(err.message || 'Failed to load attendance data');
        } finally {
            setIsLoading(false);
        }
    }, [groupId, memberLookup, members]);

    useEffect(() => {
        const fetchTerms = async () => {
            const supabase = requireSupabaseClient();
            const { data, error: termError } = await supabase
                .from('terms')
                .select('*')
                .eq('school_id', schoolId)
                .order('start_date', { ascending: false });

            if (termError) {
                console.error(termError);
                return;
            }

            setTerms(data || []);
            const active = (data || []).find(t => t.is_active) || (data || [])[0] || null;
            if (active) setSelectedTermId(active.id);
        };

        fetchTerms();
    }, [schoolId]);

    useEffect(() => {
        if (selectedTermId) {
            loadAttendanceForTerm(selectedTermId);
        }
    }, [selectedTermId, loadAttendanceForTerm]);

    const updateRow = (studentId: number, changes: Partial<OverrideRow>) => {
        setRows(prev => {
            const existing = prev[studentId] || { studentId, computedPresent: 0, computedTotal: 0, enabled: false };
            const next: OverrideRow = { ...existing, ...changes };

            // Auto-fill override values when enabling with no existing data
            if (changes.enabled && changes.enabled === true && !existing.overrideTotal) {
                next.overrideTotal = existing.computedTotal;
                next.overridePresent = existing.computedPresent;
            }

            return { ...prev, [studentId]: next };
        });
    };

    const handleSaveOverrides = async () => {
        if (!selectedTermId) return;
        const supabase = requireSupabaseClient();
        setIsSaving(true);
        setError(null);

        const rowsToSave = Object.values(rows).filter(r => r.enabled);

        for (const row of rowsToSave) {
            if (row.overrideTotal === undefined || row.overridePresent === undefined) {
                setError('Please enter total days and days present for all enabled overrides.');
                setIsSaving(false);
                return;
            }
            if (row.overridePresent > row.overrideTotal) {
                setError('Days present cannot exceed total school days.');
                setIsSaving(false);
                return;
            }
        }

        try {
            const payload = rowsToSave.map(row => ({
                student_id: row.studentId,
                class_group_id: groupId,
                term_id: selectedTermId,
                session_label: selectedTerm?.session_label || null,
                total_days: row.overrideTotal ?? 0,
                days_present: row.overridePresent ?? 0,
                comment: row.comment || null,
                created_by: userId,
                updated_by: userId,
            }));

            const { error: upsertError } = await supabase
                .from('attendance_overrides')
                .upsert(payload, { onConflict: 'student_id,class_group_id,term_id' });

            if (upsertError) throw upsertError;

            await loadAttendanceForTerm(selectedTermId);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to save overrides');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveOverride = async (studentId: number, overrideId?: number) => {
        if (!overrideId || !selectedTermId) {
            updateRow(studentId, { enabled: false, overrideId: undefined });
            return;
        }

        const supabase = requireSupabaseClient();
        try {
            setIsSaving(true);
            await supabase.from('attendance_overrides').delete().eq('id', overrideId);
            await loadAttendanceForTerm(selectedTermId);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to remove override');
        } finally {
            setIsSaving(false);
        }
    };

    const rowsArray = useMemo(() => {
        return members
            .map(member => {
                const studentId = (member as any).student_id as number | undefined;
                if (!studentId) return null;
                const row = rows[studentId];
                return row ? row : null;
            })
            .filter(Boolean) as OverrideRow[];
    }, [members, rows]);

    const hasPendingChanges = rowsArray.some(r => r.enabled);

    return (
        <div className="mt-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Manual Attendance Overrides</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Use this panel to set term-level attendance totals for <strong>{groupName}</strong> that appear on the result sheet.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <select
                        value={selectedTermId ?? ''}
                        onChange={e => setSelectedTermId(Number(e.target.value))}
                        className="px-3 py-2 border rounded-md bg-white dark:bg-slate-900"
                    >
                        <option value="" disabled>Select term</option>
                        {terms.map(term => (
                            <option key={term.id} value={term.id}>
                                {term.term_label} • {term.session_label}
                            </option>
                        ))}
                    </select>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">
                        Teacher: {teacherId ? 'Assigned' : 'Unassigned'}
                    </span>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
                    {error}
                </div>
            )}

            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <div>
                    {selectedTerm ? (
                        <>
                            Term window: {selectedTerm.start_date ? new Date(selectedTerm.start_date).toLocaleDateString() : 'N/A'} – {selectedTerm.end_date ? new Date(selectedTerm.end_date).toLocaleDateString() : 'N/A'}
                        </>
                    ) : (
                        'Select a term to view computed attendance'
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => selectedTermId && loadAttendanceForTerm(selectedTermId)}
                        className="text-sm px-3 py-1 rounded-md border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        Refresh
                    </button>
                    <button
                        onClick={handleSaveOverrides}
                        disabled={!canOverride || !hasPendingChanges || isSaving}
                        className={`text-sm px-3 py-1 rounded-md font-semibold ${!canOverride ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-60`}
                        title={!canOverride ? 'Only the assigned class teacher or admins can set overrides' : 'Save overrides for this term'}
                    >
                        {isSaving ? <Spinner size="sm" /> : 'Save Overrides'}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                        <tr>
                            <th className="p-2 text-left border-b border-slate-200 dark:border-slate-700">Student</th>
                            <th className="p-2 text-left border-b border-slate-200 dark:border-slate-700">Computed</th>
                            <th className="p-2 text-left border-b border-slate-200 dark:border-slate-700">Override</th>
                            <th className="p-2 text-left border-b border-slate-200 dark:border-slate-700">Final</th>
                            <th className="p-2 text-left border-b border-slate-200 dark:border-slate-700">Comment</th>
                            <th className="p-2 text-left border-b border-slate-200 dark:border-slate-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="p-4 text-center"><Spinner size="sm" /></td>
                            </tr>
                        ) : rowsArray.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-4 text-center text-slate-500">No students found for this class.</td>
                            </tr>
                        ) : (
                            rowsArray.map(row => {
                                const finalTotal = row.enabled ? (row.overrideTotal ?? 0) : row.computedTotal;
                                const finalPresent = row.enabled ? (row.overridePresent ?? 0) : row.computedPresent;
                                const finalRate = finalTotal > 0 ? Math.round((finalPresent / finalTotal) * 1000) / 10 : 0;

                                return (
                                    <tr key={row.studentId} className="border-b border-slate-100 dark:border-slate-800">
                                        <td className="p-2 font-semibold text-slate-800 dark:text-slate-100">{row.studentName}</td>
                                        <td className="p-2 text-slate-700 dark:text-slate-200">
                                            <div className="text-xs">Present: <strong>{row.computedPresent}</strong></div>
                                            <div className="text-xs">Total: <strong>{row.computedTotal}</strong></div>
                                        </td>
                                        <td className="p-2 space-y-1">
                                            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={row.enabled}
                                                    onChange={e => updateRow(row.studentId, { enabled: e.target.checked })}
                                                    disabled={!canOverride}
                                                />
                                                Enable manual override
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={row.overrideTotal ?? ''}
                                                    disabled={!row.enabled || !canOverride}
                                                    onChange={e => updateRow(row.studentId, { overrideTotal: Number(e.target.value) })}
                                                    placeholder="Total days"
                                                    className="w-24 px-2 py-1 border rounded"
                                                />
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={row.overridePresent ?? ''}
                                                    disabled={!row.enabled || !canOverride}
                                                    onChange={e => updateRow(row.studentId, { overridePresent: Number(e.target.value) })}
                                                    placeholder="Present"
                                                    className="w-20 px-2 py-1 border rounded"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-2 text-slate-700 dark:text-slate-200">
                                            <div className="text-xs">{finalPresent}/{finalTotal} days</div>
                                            <div className="text-xs font-semibold">{finalRate.toFixed(1)}%</div>
                                            {row.overrideId && (
                                                <div className="text-[10px] text-slate-500">Updated {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : ''}</div>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            <textarea
                                                value={row.comment || ''}
                                                onChange={e => updateRow(row.studentId, { comment: e.target.value })}
                                                disabled={!row.enabled || !canOverride}
                                                placeholder="Optional comment"
                                                className="w-full px-2 py-1 border rounded resize-none"
                                                rows={2}
                                            />
                                        </td>
                                        <td className="p-2 space-y-1">
                                            <button
                                                onClick={() => handleRemoveOverride(row.studentId, row.overrideId)}
                                                disabled={!row.overrideId || !canOverride || isSaving}
                                                className="text-xs px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                                            >
                                                Remove override
                                            </button>
                                            {row.overrideId && row.updatedBy && (
                                                <div className="text-[10px] text-slate-500">By {row.updatedBy}</div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface Props {
    members: ClassGroupMember[];
    onSaveRecord: (record: Partial<AttendanceRecord> & { member_id: number; session_date: string; id?: number }) => Promise<boolean>;
    schoolId: number;
    userId: string;
    groupId: number;
    groupName: string;
    teacherId?: string | null;
    canOverride: boolean;
}

const ClassTeacherAttendance: React.FC<Props> = ({ members, onSaveRecord, schoolId, userId, groupId, groupName, teacherId, canOverride }) => {
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

    const handleBulkNotify = async (statuses: AttendanceStatus[]) => {
        const supabase = requireSupabaseClient();
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

            // Collect students with selected statuses
            const studentsToNotify = members.filter(member => {
                const record = (member.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === null);
                return record && statuses.includes(record.status);
            });

            if (studentsToNotify.length === 0) {
                alert(`No students with status: ${statuses.join(' or ')}`);
                return;
            }

            // Get student details including phone numbers
            const studentIds = studentsToNotify.map(m => m.student_id);
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
                    const member = studentsToNotify.find(m => m.student_id === student.id);
                    const record = (member?.records || []).find(r => r.session_date === attendanceDate && r.schedule_id === null);
                    
                    if (!record) return [];

                    const templateName = 
                        record.status === AttendanceStatus.Present ? 'attendance_present' :
                        record.status === AttendanceStatus.Absent ? 'absentee_alert' :
                        'late_arrival';

                    const notificationType =
                        record.status === AttendanceStatus.Present ? 'attendance_present' :
                        record.status === AttendanceStatus.Absent ? 'absentee_alert' :
                        'late_arrival';

                    const variables = {
                        student_name: student.name,
                        date: new Date(attendanceDate).toLocaleDateString(),
                        time: new Date().toLocaleTimeString(),
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
                <div className="flex gap-2">
                    <button 
                        onClick={handleExportReport}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <DownloadIcon className="w-4 h-4" /> Export Report
                    </button>
                    <button 
                        onClick={() => handleBulkNotify([AttendanceStatus.Absent, AttendanceStatus.Late])}
                        disabled={bulkNotifying}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                        title="Notify all parents of absent and late students"
                    >
                        {bulkNotifying ? <Spinner size="sm" /> : <><BellIcon className="w-4 h-4" /> Notify Absent/Late</>}
                    </button>
                </div>
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

            <ManualAttendanceOverridePanel
                members={sortedMembers}
                groupId={groupId}
                groupName={groupName}
                teacherId={teacherId}
                canOverride={canOverride}
                schoolId={schoolId}
                userId={userId}
            />
        </div>
    );
};

export default ClassTeacherAttendance;
