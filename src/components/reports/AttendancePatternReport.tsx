import React, { useState, useRef } from 'react';
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { exportReportToPDF, exportReportToExcel, printReport } from '../../utils/reportExport';
import { ExcelColumn } from '../../utils/excelExport';
import { AttendancePatternData } from '../../services/attendanceAnalytics';

interface AttendancePatternReportProps {
  data: AttendancePatternData;
  schoolName?: string;
  schoolLogo?: string;
  isDarkMode?: boolean;
}

export const AttendancePatternReport: React.FC<AttendancePatternReportProps> = ({
  data,
  schoolName,
  schoolLogo,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'anomalies' | 'students'>('overview');
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      await exportReportToPDF(
        'Attendance Pattern Report',
        reportRef.current,
        {
          subtitle: 'Pattern Analysis & Anomaly Detection',
          schoolName,
          schoolLogo,
          generatedBy: 'Attendance System',
        }
      );
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const columns: ExcelColumn[] = [
        { key: 'date', header: 'Date', width: 15, type: 'date' },
        { key: 'attendanceRate', header: 'Attendance Rate %', width: 20, type: 'number' },
        { key: 'totalPresent', header: 'Total Present', width: 15, type: 'number' },
        { key: 'totalAbsent', header: 'Total Absent', width: 15, type: 'number' },
      ];

      await exportReportToExcel(
        data.heatmapData,
        columns,
        'Attendance_Pattern_Report',
        'Daily Attendance'
      );
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Failed to export Excel. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (reportRef.current) {
      printReport(reportRef.current);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#10b981';
    }
  };

  return (
    <div className={`p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Attendance Pattern Report</h1>
            <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Pattern Analysis & Anomaly Detection
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className={`px-4 py-2 rounded ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors disabled:opacity-50`}
            >
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className={`px-4 py-2 rounded ${isDarkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white transition-colors disabled:opacity-50`}
            >
              Export Excel
            </button>
            <button
              onClick={handlePrint}
              className={`px-4 py-2 rounded ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-500 hover:bg-gray-600'} text-white transition-colors`}
            >
              Print
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-300 dark:border-gray-700">
          {['overview', 'patterns', 'anomalies', 'students'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-medium capitalize transition-colors ${
                activeTab === tab
                  ? `border-b-2 ${isDarkMode ? 'border-blue-400 text-blue-400' : 'border-blue-600 text-blue-600'}`
                  : isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="space-y-6">
        {activeTab === 'overview' && (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-blue-500 to-blue-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Average Attendance</p>
                <p className="text-3xl font-bold">{data.overview.averageAttendance.toFixed(1)}%</p>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-green-500 to-green-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Total Days</p>
                <p className="text-3xl font-bold">{data.overview.totalDays}</p>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-purple-500 to-purple-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Total Students</p>
                <p className="text-3xl font-bold">{data.overview.totalStudents}</p>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-red-500 to-red-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Chronic Absentees</p>
                <p className="text-3xl font-bold">{data.overview.chronicAbsentees}</p>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-yellow-500 to-yellow-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Perfect Attendance</p>
                <p className="text-3xl font-bold">{data.overview.perfectAttendance}</p>
              </div>
            </div>

            {/* Attendance Trend */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Daily Attendance Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.heatmapData.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="date" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="attendanceRate" stroke="#3b82f6" strokeWidth={2} name="Attendance Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeTab === 'patterns' && (
          <>
            {/* Day of Week Analysis */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Attendance by Day of Week</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.dayOfWeekAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="day" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                  />
                  <Bar dataKey="averageAttendance" name="Average Attendance %">
                    {data.dayOfWeekAnalysis.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.mostAbsentDay ? '#ef4444' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Calendar Heatmap Placeholder */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Attendance Heatmap (Last 30 Days)</h3>
              <div className="grid grid-cols-7 gap-2">
                {data.heatmapData.slice(-30).map((day, index) => {
                  const opacity = day.attendanceRate / 100;
                  return (
                    <div
                      key={index}
                      className="aspect-square rounded flex items-center justify-center text-xs font-medium"
                      style={{
                        backgroundColor: `rgba(59, 130, 246, ${opacity})`,
                        color: opacity > 0.5 ? '#fff' : '#000',
                      }}
                      title={`${day.date}: ${day.attendanceRate.toFixed(1)}%`}
                    >
                      {day.attendanceRate.toFixed(0)}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeTab === 'anomalies' && (
          <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <h3 className="text-lg font-bold mb-4">Detected Anomalies</h3>
            {data.anomalies.length === 0 ? (
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>No significant anomalies detected.</p>
            ) : (
              <div className="space-y-4">
                {data.anomalies.map((anomaly, index) => (
                  <div key={index} className={`p-4 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-lg">{new Date(anomaly.date).toLocaleDateString()}</p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Deviation: {anomaly.deviation.toFixed(1)}%
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded ${anomaly.actualRate < anomaly.expectedRate ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {anomaly.actualRate < anomaly.expectedRate ? 'Low' : 'High'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Expected</p>
                        <p className="text-xl font-bold">{anomaly.expectedRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Actual</p>
                        <p className="text-xl font-bold">{anomaly.actualRate.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div>
                      <p className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Possible Reasons:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {anomaly.possibleReasons.map((reason, idx) => (
                          <li key={idx} className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'students' && (
          <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <h3 className="text-lg font-bold mb-4">Student Attendance Patterns</h3>
            <div className="overflow-x-auto">
              <table className={`w-full ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}>
                  <tr>
                    <th className="px-4 py-2 text-left">Student Name</th>
                    <th className="px-4 py-2 text-center">Attendance Rate</th>
                    <th className="px-4 py-2 text-center">Pattern</th>
                    <th className="px-4 py-2 text-center">Risk Level</th>
                    <th className="px-4 py-2 text-left">Common Absence Days</th>
                  </tr>
                </thead>
                <tbody>
                  {data.studentPatterns.slice(0, 20).map((student, index) => (
                    <tr
                      key={index}
                      className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
                    >
                      <td className="px-4 py-2">{student.name}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`font-bold ${student.attendanceRate >= 90 ? 'text-green-600' : student.attendanceRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {student.attendanceRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center capitalize">{student.pattern}</td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className="px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: getRiskColor(student.riskLevel) }}
                        >
                          {student.riskLevel.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {student.commonAbsenceDays.join(', ') || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendancePatternReport;
