import React from 'react';
import { getAttendanceStatus, getAttendanceProgressColor, getAttendanceProgressColorPrint } from '../../utils/attendanceHelpers';

interface Subject {
  name: string;
  score: number;
  grade: string;
  position?: number;
  teacher_comment?: string;
}

interface ReportCardData {
  student: {
    name: string;
    admission_number: string;
    class: string;
    photo_url?: string;
  };
  school: {
    name: string;
    logo_url?: string;
    address?: string;
    motto?: string;
  };
  term: {
    name: string;
    year: string;
  };
  subjects: Subject[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    unexcused: number;
    total: number;
    rate: number;
  };
  conduct?: {
    behavior: string;
    punctuality: string;
    neatness: string;
  };
  classTeacherRemark?: string;
  principalRemark?: string;
  nextTermBegins?: string;
}

interface PrintableReportCardProps {
  data: ReportCardData;
  template?: 'classic' | 'modern' | 'minimal';
}

export const PrintableReportCard: React.FC<PrintableReportCardProps> = ({
  data,
  template = 'classic',
}) => {
  const { student, school, term, subjects, attendance, conduct, classTeacherRemark, principalRemark, nextTermBegins } = data;

  const getGradeColor = (grade: string) => {
    if (grade === 'A' || grade === 'A1' || grade === 'A+') return 'text-green-600';
    if (grade.startsWith('B')) return 'text-blue-600';
    if (grade.startsWith('C')) return 'text-yellow-600';
    if (grade.startsWith('D')) return 'text-orange-600';
    return 'text-red-600';
  };

  const getOrdinal = (value?: number) => {
    if (!value) return '-';
    const suffix = value % 10 === 1 && value % 100 !== 11
      ? 'st'
      : value % 10 === 2 && value % 100 !== 12
        ? 'nd'
        : value % 10 === 3 && value % 100 !== 13
          ? 'rd'
          : 'th';
    return `${value}${suffix}`;
  };

  const totalSubjects = subjects.length;
  const totalScore = subjects.reduce((sum, subject) => sum + (subject.score || 0), 0);
  const averageScore = totalSubjects ? (totalScore / totalSubjects).toFixed(1) : '0.0';
  const bestSubject = subjects.reduce<Subject | null>((best, current) => {
    if (!best) return current;
    return current.score > best.score ? current : best;
  }, null);

  const attendancePercentage = attendance.rate.toFixed(1);
  const attendanceStatus = getAttendanceStatus(attendance.rate);

  if (template === 'modern') {
    return (
      <div className="report-card report-print-root modern bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 p-10 max-w-5xl mx-auto shadow-xl rounded-2xl border border-slate-200">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 backdrop-blur mb-8 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-500/10 to-emerald-500/10" aria-hidden="true"></div>
          <div className="relative px-8 py-6 text-center">
            <div className="flex items-center justify-center gap-4">
              {school.logo_url && (
                <div className="w-20 h-20 rounded-full bg-white/80 border border-slate-200 shadow-inner flex items-center justify-center overflow-hidden">
                  <img src={school.logo_url} alt="School Logo" className="w-16 h-16 object-contain" />
                </div>
              )}
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Official Transcript</p>
                <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">{school.name}</h1>
                {school.address && <p className="text-sm text-slate-600 mt-1">{school.address}</p>}
                {school.motto && <p className="text-xs italic text-slate-500 mt-1">"{school.motto}"</p>}
              </div>
            </div>
            <div className="mt-6 inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-full shadow">
              <span className="text-sm uppercase tracking-[0.24em] font-semibold">{term.name}</span>
              <span className="text-sm font-semibold">Report Card</span>
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">{term.year}</span>
            </div>
          </div>
        </div>

        {/* Student Info */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          <div className="col-span-12 md:col-span-4">
            <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-2xl border-2 border-blue-100 bg-blue-50 flex items-center justify-center overflow-hidden mb-3 shadow-inner">
                {student.photo_url ? (
                  <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-3xl text-blue-500 font-semibold">{student.name?.[0] || '?'}</div>
                )}
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Student</p>
              <p className="text-xl font-bold text-slate-900">{student.name}</p>
              <p className="text-sm text-slate-500 mt-1">ID • {student.admission_number}</p>
            </div>
          </div>

          <div className="col-span-12 md:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase">Class</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{student.class}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase">Subjects</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{totalSubjects}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase">Attendance</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{attendancePercentage}%</p>
              <p className="text-xs text-slate-500">{attendance.present}/{attendance.total} days</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase">Average Score</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{averageScore}%</p>
              <p className="text-xs text-slate-500">Across all subjects</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-500 uppercase">Top Subject</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{bestSubject?.name || '—'}</p>
              <p className="text-xs text-slate-500">Score: {bestSubject?.score ?? '—'} ({bestSubject?.grade || '—'})</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${attendanceStatus.bgColor}`}>
                {attendanceStatus.emoji}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Attendance Status</p>
                <p className={`text-sm font-semibold ${attendanceStatus.color}`}>{attendanceStatus.label}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subjects Table */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase text-slate-500 tracking-[0.2em]">Academic Performance</p>
              <h3 className="text-xl font-bold text-slate-900">Subject Breakdown</h3>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <span className="h-3 w-3 rounded-full bg-blue-600"></span>
              <span>Core Grades</span>
              <span className="h-3 w-3 rounded-full bg-slate-200"></span>
              <span>Alternating Rows</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-4 py-3 text-left font-semibold">Subject</th>
                  <th className="px-4 py-3 text-center font-semibold">Score</th>
                  <th className="px-4 py-3 text-center font-semibold">Grade</th>
                  <th className="px-4 py-3 text-center font-semibold">Position</th>
                  <th className="px-4 py-3 text-left font-semibold">Teacher's Comment</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{subject.name}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{subject.score}</td>
                    <td className={`px-4 py-3 text-center text-sm font-extrabold ${getGradeColor(subject.grade)}`}>
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                        {subject.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">{getOrdinal(subject.position)}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{subject.teacher_comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Attendance Summary */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase text-slate-500 tracking-[0.2em]">Attendance</p>
                <h3 className="text-xl font-bold text-slate-900">Presence & Punctuality</h3>
              </div>
              <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{attendance.total} recorded days</div>
            </div>
            {attendance.total > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                    <p className="text-[11px] text-slate-500 uppercase">Days Present</p>
                    <p className="text-2xl font-bold text-emerald-600">{attendance.present}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                    <p className="text-[11px] text-slate-500 uppercase">Days Absent</p>
                    <p className="text-2xl font-bold text-rose-600">{attendance.absent}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                    <p className="text-[11px] text-slate-500 uppercase">Days Late</p>
                    <p className="text-2xl font-bold text-amber-600">{attendance.late}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                    <p className="text-[11px] text-slate-500 uppercase">Excused</p>
                    <p className="text-2xl font-bold text-blue-600">{attendance.excused}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                    <p className="text-[11px] text-slate-500 uppercase">Unexcused</p>
                    <p className="text-2xl font-bold text-red-700">{attendance.unexcused}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                    <p className="text-[11px] text-slate-500 uppercase">Total Days</p>
                    <p className="text-2xl font-bold text-slate-800">{attendance.total}</p>
                  </div>
                </div>

                <div className={`border border-slate-200 rounded-2xl p-4 shadow-sm ${attendanceStatus.bgColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs uppercase text-slate-500">Overall Attendance Rate</p>
                      <p className={`text-lg font-semibold ${attendanceStatus.color}`}>{attendanceStatus.label}</p>
                    </div>
                    <span className={`text-2xl font-bold ${attendanceStatus.color}`}>{attendancePercentage}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 mb-2">
                    <div
                      className={`h-3 rounded-full transition-all ${getAttendanceProgressColor(attendance.rate)}`}
                      style={{ width: `${Math.min(attendance.rate, 100)}%` }}
                    ></div>
                  </div>
                  <p className={`text-xs font-semibold text-center ${attendanceStatus.color}`}>
                    {attendanceStatus.emoji} {attendanceStatus.label}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-center text-slate-500 py-6 bg-white border border-slate-200 rounded-xl">No attendance records available for this term.</p>
            )}
          </div>

          {/* Conduct */}
          {conduct && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-full">
              <p className="text-xs uppercase text-slate-500 tracking-[0.2em] mb-2">Character</p>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Conduct & Attributes</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Behavior</span>
                  <span className="font-semibold text-slate-900">{conduct.behavior}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Punctuality</span>
                  <span className="font-semibold text-slate-900">{conduct.punctuality}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Neatness</span>
                  <span className="font-semibold text-slate-900">{conduct.neatness}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Remarks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {classTeacherRemark && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
              <p className="text-xs uppercase text-slate-500 tracking-[0.18em]">Class Teacher's Remark</p>
              <p className="text-sm text-slate-800 mt-2 leading-relaxed">{classTeacherRemark}</p>
            </div>
          )}
          {principalRemark && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
              <p className="text-xs uppercase text-slate-500 tracking-[0.18em]">Principal's Remark</p>
              <p className="text-sm text-slate-800 mt-2 leading-relaxed">{principalRemark}</p>
            </div>
          )}
        </div>

        {/* Grading Scale */}
        <div className="mb-8 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs uppercase text-slate-500 tracking-[0.2em]">Grading Scale</p>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-full">A (80-100) <span className="text-emerald-600">Excellent</span></span>
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-full">B (70-79) <span className="text-blue-600">Very Good</span></span>
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-full">C (60-69) <span className="text-amber-600">Good</span></span>
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-100 rounded-full">D (50-59) <span className="text-orange-600">Pass</span></span>
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-100 rounded-full">F (0-49) <span className="text-rose-600">Fail</span></span>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <p className="text-sm text-slate-600 mb-6 font-semibold">Class Teacher's Signature</p>
            <div className="border-t border-slate-300 pt-2">
              <p className="text-xs text-slate-500">Signature & Date</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <p className="text-sm text-slate-600 mb-6 font-semibold">Principal's Signature</p>
            <div className="border-t border-slate-300 pt-2">
              <p className="text-xs text-slate-500">Signature & Date</p>
            </div>
          </div>
        </div>

        {nextTermBegins && (
          <div className="text-center text-sm text-slate-600 mt-6">
            <p className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Next term begins on <span className="font-semibold text-slate-900">{nextTermBegins}</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  // Classic template (default)
  return (
    <div className="report-card report-print-root classic bg-white text-black p-8 max-w-4xl mx-auto border-8 border-double border-gray-800">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
        {school.logo_url && (
          <img src={school.logo_url} alt="School Logo" className="w-20 h-20 mx-auto mb-3 object-contain" />
        )}
        <h1 className="text-2xl font-bold uppercase">{school.name}</h1>
        {school.address && <p className="text-sm mt-1">{school.address}</p>}
        {school.motto && <p className="text-xs italic mt-1">"{school.motto}"</p>}
        <h2 className="text-xl font-semibold mt-3 uppercase">
          {term.name} Report Card - {term.year}
        </h2>
      </div>

      {/* Student Info */}
      <div className="flex gap-4 mb-6 border border-gray-300 p-4">
        {student.photo_url && (
          <div className="flex-shrink-0">
            <img
              src={student.photo_url}
              alt={student.name}
              className="w-24 h-24 object-cover border-2 border-gray-400"
            />
          </div>
        )}
        <div className="flex-1">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="font-semibold py-1">Student Name:</td>
                <td className="py-1">{student.name}</td>
              </tr>
              <tr>
                <td className="font-semibold py-1">Admission Number:</td>
                <td className="py-1">{student.admission_number}</td>
              </tr>
              <tr>
                <td className="font-semibold py-1">Class:</td>
                <td className="py-1">{student.class}</td>
              </tr>
              <tr>
                <td className="font-semibold py-1">Attendance:</td>
                <td className="py-1">{attendance.present} out of {attendance.total} days ({attendancePercentage}%)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2 uppercase">Academic Record</h3>
        <table className="w-full border-2 border-gray-800">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-800 px-3 py-2 text-left">Subject</th>
              <th className="border border-gray-800 px-3 py-2 text-center">Score</th>
              <th className="border border-gray-800 px-3 py-2 text-center">Grade</th>
              <th className="border border-gray-800 px-3 py-2 text-center">Position</th>
              <th className="border border-gray-800 px-3 py-2 text-left">Remark</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject, index) => (
              <tr key={index}>
                <td className="border border-gray-800 px-3 py-2">{subject.name}</td>
                <td className="border border-gray-800 px-3 py-2 text-center">{subject.score}</td>
                <td className={`border border-gray-800 px-3 py-2 text-center font-bold ${getGradeColor(subject.grade)}`}>
                  {subject.grade}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-center">
                  {subject.position || '-'}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm">{subject.teacher_comment || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detailed Attendance Summary */}
      <div className="mb-6 border border-gray-800 p-4">
        <h3 className="text-lg font-semibold mb-3 uppercase">Attendance Summary</h3>
        {attendance.total > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 border border-gray-400 p-3 text-center">
                <p className="text-xs text-gray-600 uppercase font-semibold">Days Present</p>
                <p className="text-2xl font-bold text-green-700">{attendance.present}</p>
              </div>
              <div className="bg-gray-50 border border-gray-400 p-3 text-center">
                <p className="text-xs text-gray-600 uppercase font-semibold">Days Absent</p>
                <p className="text-2xl font-bold text-red-700">{attendance.absent}</p>
              </div>
              <div className="bg-gray-50 border border-gray-400 p-3 text-center">
                <p className="text-xs text-gray-600 uppercase font-semibold">Days Late</p>
                <p className="text-2xl font-bold text-orange-700">{attendance.late}</p>
              </div>
              <div className="bg-gray-50 border border-gray-400 p-3 text-center">
                <p className="text-xs text-gray-600 uppercase font-semibold">Excused</p>
                <p className="text-2xl font-bold text-blue-700">{attendance.excused}</p>
              </div>
              <div className="bg-gray-50 border border-gray-400 p-3 text-center">
                <p className="text-xs text-gray-600 uppercase font-semibold">Unexcused</p>
                <p className="text-2xl font-bold text-red-800">{attendance.unexcused}</p>
              </div>
              <div className="bg-gray-50 border border-gray-400 p-3 text-center">
                <p className="text-xs text-gray-600 uppercase font-semibold">Total Days</p>
                <p className="text-2xl font-bold text-gray-800">{attendance.total}</p>
              </div>
            </div>
            
            <div className={`border-2 p-3 ${attendanceStatus.bgColor}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Overall Attendance Rate</span>
                <span className={`text-lg font-bold ${attendanceStatus.color}`}>{attendancePercentage}%</span>
              </div>
              <div className="w-full bg-gray-300 h-4 mb-2 border border-gray-400">
                <div 
                  className={`h-full ${getAttendanceProgressColorPrint(attendance.rate)}`}
                  style={{ width: `${Math.min(attendance.rate, 100)}%` }}
                ></div>
              </div>
              <p className={`text-center text-sm font-semibold ${attendanceStatus.color}`}>
                {attendanceStatus.emoji} {attendanceStatus.label}
              </p>
            </div>
          </>
        ) : (
          <p className="text-center text-gray-600 py-4">No attendance records available for this term.</p>
        )}
      </div>

      {/* Conduct */}
      {conduct && (
        <div className="mb-6 border border-gray-800 p-3">
          <h3 className="text-lg font-semibold mb-2 uppercase">Conduct & Attributes</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-semibold">Behavior:</span> {conduct.behavior}
            </div>
            <div>
              <span className="font-semibold">Punctuality:</span> {conduct.punctuality}
            </div>
            <div>
              <span className="font-semibold">Neatness:</span> {conduct.neatness}
            </div>
          </div>
        </div>
      )}

      {/* Remarks */}
      <div className="space-y-3 mb-6">
        {classTeacherRemark && (
          <div className="border border-gray-800 p-3">
            <p className="text-sm font-semibold uppercase">Class Teacher's Remark:</p>
            <p className="text-sm mt-1">{classTeacherRemark}</p>
          </div>
        )}
        {principalRemark && (
          <div className="border border-gray-800 p-3">
            <p className="text-sm font-semibold uppercase">Principal's Remark:</p>
            <p className="text-sm mt-1">{principalRemark}</p>
          </div>
        )}
      </div>

      {/* Grading Legend */}
      <div className="mb-6 border border-gray-800 p-3">
        <p className="text-sm font-semibold uppercase mb-1">Grading Scale:</p>
        <p className="text-xs">
          A (80-100): Excellent | B (70-79): Very Good | C (60-69): Good | D (50-59): Pass | F (0-49): Fail
        </p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="text-sm font-semibold mb-6">Class Teacher's Signature:</p>
          <div className="border-t-2 border-gray-800"></div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-6">Principal's Signature:</p>
          <div className="border-t-2 border-gray-800"></div>
        </div>
      </div>

      {nextTermBegins && (
        <div className="text-center text-sm mt-4">
          <p>Next term begins: <span className="font-semibold">{nextTermBegins}</span></p>
        </div>
      )}
    </div>
  );
};

export default PrintableReportCard;
