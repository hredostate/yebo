import React, { useState, useEffect } from 'react';
import { supabase } from '../../offline/client';
import type {
  TransportDirection,
  TransportAttendanceStatus,
  TransportClassGroup,
} from '../../types';
import { handleSupabaseError } from '../../utils/errorHandling';

interface AttendanceStudent {
  trip_id: number;
  student_id: number;
  student_name: string;
  route_name: string;
  stop_name: string;
  class_group_name: string;
  attendance_status: TransportAttendanceStatus | null;
  marked_at: string | null;
}

interface TeacherTransportAttendanceProps {
  userId: string;
  schoolId: number;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function TeacherTransportAttendance({
  userId,
  schoolId,
  addToast,
}: TeacherTransportAttendanceProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [direction, setDirection] = useState<TransportDirection>('morning_pickup' as TransportDirection);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    loadAttendance();
  }, [date, direction]);

  useEffect(() => {
    // Extract unique groups from students
    const uniqueGroups = [...new Set(students.map(s => s.class_group_name))];
    setGroups(uniqueGroups);
  }, [students]);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_teacher_transport_attendance', {
        p_user_id: userId,
        p_date: date,
        p_direction: direction,
      });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (
    tripId: number,
    studentId: number,
    status: TransportAttendanceStatus,
    groupName: string
  ) => {
    try {
      // Find class group ID from the student data
      const student = students.find(s => s.student_id === studentId);
      if (!student) return;

      const { data, error } = await supabase.rpc('mark_transport_attendance_by_teacher', {
        p_trip_id: tripId,
        p_student_id: studentId,
        p_status: status,
        p_marked_by: userId,
        p_class_group_id: null, // Will need to get this from the data
        p_note: null,
        p_send_sms: true, // Auto-send SMS
      });

      if (error) throw error;
      
      // Update local state
      setStudents(prev =>
        prev.map(s =>
          s.student_id === studentId
            ? { ...s, attendance_status: status, marked_at: new Date().toISOString() }
            : s
        )
      );
      
      addToast('Attendance marked successfully', 'success');
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to mark attendance');
    }
  };

  const getStatusColor = (status: TransportAttendanceStatus | null): string => {
    if (!status) return 'bg-gray-100 text-gray-600';
    
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      case 'excused':
        return 'bg-blue-100 text-blue-800';
      case 'parent_pickup':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: TransportAttendanceStatus | null): string => {
    if (!status) return 'Not Marked';
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const filteredStudents = selectedGroup
    ? students.filter(s => s.class_group_name === selectedGroup)
    : students;

  const statusCounts = {
    present: students.filter(s => s.attendance_status === 'present').length,
    absent: students.filter(s => s.attendance_status === 'absent').length,
    late: students.filter(s => s.attendance_status === 'late').length,
    excused: students.filter(s => s.attendance_status === 'excused').length,
    parent_pickup: students.filter(s => s.attendance_status === 'parent_pickup').length,
    unmarked: students.filter(s => !s.attendance_status).length,
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Transport Attendance</h1>
        <p className="text-gray-600 mt-1">Mark student attendance for transport services</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as TransportDirection)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="morning_pickup">Morning Pickup</option>
              <option value="afternoon_dropoff">Afternoon Dropoff</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Filter by Group</label>
            <select
              value={selectedGroup || ''}
              onChange={(e) => setSelectedGroup(e.target.value || null)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">All Groups</option>
              {groups.map(group => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-800">{statusCounts.present}</div>
          <div className="text-sm text-green-600">Present</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-800">{statusCounts.absent}</div>
          <div className="text-sm text-red-600">Absent</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-800">{statusCounts.late}</div>
          <div className="text-sm text-yellow-600">Late</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-800">{statusCounts.excused}</div>
          <div className="text-sm text-blue-600">Excused</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-800">{statusCounts.parent_pickup}</div>
          <div className="text-sm text-purple-600">Parent Pickup</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-800">{statusCounts.unmarked}</div>
          <div className="text-sm text-gray-600">Unmarked</div>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No students found for this date and direction.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Route</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stop</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Group</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student.student_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{student.student_name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{student.route_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{student.stop_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{student.class_group_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(student.attendance_status)}`}>
                        {getStatusLabel(student.attendance_status)}
                      </span>
                      {student.marked_at && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(student.marked_at).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => markAttendance(student.trip_id, student.student_id, 'present', student.class_group_name)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Present
                        </button>
                        <button
                          onClick={() => markAttendance(student.trip_id, student.student_id, 'absent', student.class_group_name)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Absent
                        </button>
                        <button
                          onClick={() => markAttendance(student.trip_id, student.student_id, 'late', student.class_group_name)}
                          className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                        >
                          Late
                        </button>
                        {direction === 'afternoon_dropoff' && (
                          <button
                            onClick={() => markAttendance(student.trip_id, student.student_id, 'parent_pickup', student.class_group_name)}
                            className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                          >
                            Parent
                          </button>
                        )}
                        <button
                          onClick={() => markAttendance(student.trip_id, student.student_id, 'excused', student.class_group_name)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Excused
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SMS Note */}
      {students.some(s => s.attendance_status && ['absent', 'late'].includes(s.attendance_status)) && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            📱 <strong>SMS notifications</strong> are automatically sent to parents when you mark students as absent or late.
          </p>
        </div>
      )}
    </div>
  );
}
