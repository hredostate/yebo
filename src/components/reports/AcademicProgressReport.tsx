import React, { useState, useRef } from 'react';
import { LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { exportReportToPDF, exportReportToExcel, printReport } from '../../utils/reportExport';
import { ExcelColumn } from '../../utils/excelExport';

interface AcademicReportData {
  student: {
    id: number;
    name: string;
    class: string;
    admissionNumber: string;
  };
  termComparison: {
    term: string;
    average: number;
    rank: number;
    totalStudents: number;
  }[];
  subjectBreakdown: {
    subject: string;
    scores: number[];
    trend: 'improving' | 'stable' | 'declining';
    classAverage: number;
    percentile: number;
  }[];
  strengthsWeaknesses: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

interface AcademicProgressReportProps {
  data: AcademicReportData;
  schoolName?: string;
  schoolLogo?: string;
  isDarkMode?: boolean;
}

export const AcademicProgressReport: React.FC<AcademicProgressReportProps> = ({
  data,
  schoolName,
  schoolLogo,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'analysis'>('overview');
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      await exportReportToPDF(
        `Academic Progress Report - ${data.student.name}`,
        reportRef.current,
        {
          subtitle: `${data.student.class} - ${data.student.admissionNumber}`,
          schoolName,
          schoolLogo,
          generatedBy: 'Academic System',
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
      // Prepare term comparison data
      const termColumns: ExcelColumn[] = [
        { key: 'term', header: 'Term', width: 20 },
        { key: 'average', header: 'Average Score', width: 15, type: 'number' },
        { key: 'rank', header: 'Rank', width: 10, type: 'number' },
        { key: 'totalStudents', header: 'Total Students', width: 15, type: 'number' },
      ];

      // Prepare subject breakdown data
      const subjectColumns: ExcelColumn[] = [
        { key: 'subject', header: 'Subject', width: 20 },
        { key: 'latestScore', header: 'Latest Score', width: 15, type: 'number' },
        { key: 'trend', header: 'Trend', width: 15 },
        { key: 'classAverage', header: 'Class Average', width: 15, type: 'number' },
        { key: 'percentile', header: 'Percentile', width: 15, type: 'number' },
      ];

      const subjectData = data.subjectBreakdown.map(subject => ({
        subject: subject.subject,
        latestScore: subject.scores[subject.scores.length - 1] || 0,
        trend: subject.trend,
        classAverage: subject.classAverage,
        percentile: subject.percentile,
      }));

      await exportReportToExcel(
        [...data.termComparison],
        termColumns,
        `Academic_Progress_${data.student.name.replace(/\s+/g, '_')}`,
        'Term Comparison'
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

  // Calculate overall performance
  const overallAverage = data.termComparison.length > 0
    ? data.termComparison[data.termComparison.length - 1].average
    : 0;

  const performanceColor = overallAverage >= 75 ? '#10b981' : overallAverage >= 50 ? '#f59e0b' : '#ef4444';

  const trendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving':
        return <span className="text-green-500">↑</span>;
      case 'declining':
        return <span className="text-red-500">↓</span>;
      default:
        return <span className="text-gray-500">→</span>;
    }
  };

  return (
    <div className={`p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Academic Progress Report</h1>
            <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {data.student.name} - {data.student.class}
            </p>
            <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Admission Number: {data.student.admissionNumber}
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
          {['overview', 'subjects', 'analysis'].map((tab) => (
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
            {/* Performance Summary */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h2 className="text-xl font-bold mb-4">Overall Performance</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Current Average</p>
                  <p className="text-3xl font-bold" style={{ color: performanceColor }}>
                    {overallAverage.toFixed(1)}%
                  </p>
                </div>
                <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Current Rank</p>
                  <p className="text-3xl font-bold">
                    {data.termComparison.length > 0
                      ? `${data.termComparison[data.termComparison.length - 1].rank}/${data.termComparison[data.termComparison.length - 1].totalStudents}`
                      : 'N/A'}
                  </p>
                </div>
                <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Subjects</p>
                  <p className="text-3xl font-bold">{data.subjectBreakdown.length}</p>
                </div>
              </div>
            </div>

            {/* Term Progression Chart */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Score Progression Over Terms</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.termComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="term" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="average" stroke="#3b82f6" strokeWidth={2} name="Average Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Class Ranking */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Class Ranking Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.termComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="term" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="rank" fill="#8b5cf6" name="Class Rank" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeTab === 'subjects' && (
          <>
            {/* Subject Performance Radar */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Subject Performance Comparison</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={data.subjectBreakdown.map(s => ({
                  subject: s.subject,
                  score: s.scores[s.scores.length - 1] || 0,
                  classAverage: s.classAverage,
                }))}>
                  <PolarGrid stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <PolarAngleAxis dataKey="subject" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <PolarRadiusAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <Radar name="Your Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  <Radar name="Class Average" dataKey="classAverage" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  <Legend />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Subject Details Table */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Subject-wise Performance Breakdown</h3>
              <div className="overflow-x-auto">
                <table className={`w-full ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                  <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}>
                    <tr>
                      <th className="px-4 py-2 text-left">Subject</th>
                      <th className="px-4 py-2 text-center">Latest Score</th>
                      <th className="px-4 py-2 text-center">Trend</th>
                      <th className="px-4 py-2 text-center">Class Average</th>
                      <th className="px-4 py-2 text-center">Percentile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subjectBreakdown.map((subject, index) => (
                      <tr
                        key={index}
                        className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
                      >
                        <td className="px-4 py-2">{subject.subject}</td>
                        <td className="px-4 py-2 text-center font-bold">
                          {subject.scores[subject.scores.length - 1]?.toFixed(1) || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-center text-xl">
                          {trendIcon(subject.trend)}
                        </td>
                        <td className="px-4 py-2 text-center">{subject.classAverage.toFixed(1)}</td>
                        <td className="px-4 py-2 text-center">{subject.percentile.toFixed(0)}th</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'analysis' && (
          <>
            {/* Strengths and Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <h3 className="text-lg font-bold mb-4 text-green-600">Strengths</h3>
                <ul className="space-y-2">
                  {data.strengthsWeaknesses.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <h3 className="text-lg font-bold mb-4 text-red-600">Areas for Improvement</h3>
                <ul className="space-y-2">
                  {data.strengthsWeaknesses.weaknesses.map((weakness, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-red-500 mr-2">!</span>
                      <span>{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recommendations */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Recommendations</h3>
              <ul className="space-y-3">
                {data.strengthsWeaknesses.recommendations.map((recommendation, index) => (
                  <li key={index} className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                    <span className="font-medium">{index + 1}.</span> {recommendation}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AcademicProgressReport;
