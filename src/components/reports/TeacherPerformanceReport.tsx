import React, { useState, useRef } from 'react';
import {
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { exportReportToPDF, exportReportToExcel, printReport } from '../../utils/reportExport';
import { TeacherPerformanceData } from '../../services/teacherAnalytics';

interface TeacherPerformanceReportProps {
  data: TeacherPerformanceData;
  schoolName?: string;
  schoolLogo?: string;
  isDarkMode?: boolean;
}

export const TeacherPerformanceReport: React.FC<TeacherPerformanceReportProps> = ({
  data,
  schoolName,
  schoolLogo,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'feedback'>('overview');
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      await exportReportToPDF(
        `Teacher Performance Report - ${data.teacher.name}`,
        reportRef.current,
        {
          subtitle: 'Performance & Feedback Analysis',
          schoolName,
          schoolLogo,
          generatedBy: 'HR System',
        }
      );
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <span className="text-green-500">↑</span>;
      case 'down': return <span className="text-red-500">↓</span>;
      default: return <span className="text-gray-500">→</span>;
    }
  };

  return (
    <div className={`p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Teacher Performance Report</h1>
            <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {data.teacher.name}
            </p>
            <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              {data.teacher.subjects.join(', ')} • {data.teacher.yearsOfExperience} years experience
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
              onClick={() => reportRef.current && printReport(reportRef.current)}
              className={`px-4 py-2 rounded ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-500 hover:bg-gray-600'} text-white transition-colors`}
            >
              Print
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-300 dark:border-gray-700">
          {['overview', 'performance', 'feedback'].map((tab) => (
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
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-blue-500 to-blue-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Lesson Plan Completion</p>
                <p className="text-3xl font-bold">{data.kpis.lessonPlanCompletion.toFixed(1)}%</p>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-green-500 to-green-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Attendance Rate</p>
                <p className="text-3xl font-bold">{data.kpis.attendanceRate.toFixed(1)}%</p>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-purple-500 to-purple-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Class Performance</p>
                <p className="text-3xl font-bold">{data.kpis.averageClassPerformance.toFixed(1)}%</p>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-yellow-500 to-yellow-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Student Satisfaction</p>
                <p className="text-3xl font-bold">{data.kpis.studentSatisfaction.toFixed(1)}%</p>
              </div>
            </div>

            {/* Overall Rating */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Overall Rating</h3>
              <div className="flex items-center gap-4">
                <div className="text-6xl font-bold" style={{ color: data.ratings.overall >= 4 ? '#10b981' : data.ratings.overall >= 3 ? '#f59e0b' : '#ef4444' }}>
                  {data.ratings.overall.toFixed(1)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={`text-2xl ${star <= data.ratings.overall ? 'text-yellow-400' : 'text-gray-400'}`}>
                        ★
                      </span>
                    ))}
                  </div>
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Based on {data.feedbackAnalysis.totalFeedbacks} feedback responses
                  </p>
                </div>
              </div>
            </div>

            {/* Rating Trends */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Rating Trends Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.ratings.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="period" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} domain={[0, 5]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                  />
                  <Line type="monotone" dataKey="rating" stroke="#3b82f6" strokeWidth={2} name="Rating" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeTab === 'performance' && (
          <>
            {/* Performance Breakdown Radar */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Performance Across Categories</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={data.ratings.breakdown}>
                  <PolarGrid stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <PolarAngleAxis dataKey="category" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <PolarRadiusAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} domain={[0, 5]} />
                  <Radar name="Rating" dataKey="rating" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
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

            {/* Performance Breakdown Table */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Category Breakdown</h3>
              <div className="overflow-x-auto">
                <table className={`w-full ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                  <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}>
                    <tr>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-center">Rating</th>
                      <th className="px-4 py-2 text-center">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ratings.breakdown.map((category, index) => (
                      <tr key={index} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className="px-4 py-2">{category.category}</td>
                        <td className="px-4 py-2 text-center font-bold">{category.rating.toFixed(1)}</td>
                        <td className="px-4 py-2 text-center text-xl">{getTrendIcon(category.trend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Class Performance */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Class Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.classPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="className" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="averageScore" fill="#3b82f6" name="Average Score" />
                  <Bar dataKey="passRate" fill="#10b981" name="Pass Rate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeTab === 'feedback' && (
          <>
            {/* Sentiment Analysis */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Feedback Sentiment Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                  <p className="text-sm text-green-600 mb-2">Positive</p>
                  <p className="text-3xl font-bold">{data.feedbackAnalysis.sentimentBreakdown.positive}</p>
                  <p className="text-sm mt-1">
                    {data.feedbackAnalysis.totalFeedbacks > 0 
                      ? ((data.feedbackAnalysis.sentimentBreakdown.positive / data.feedbackAnalysis.totalFeedbacks) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                  <p className="text-sm text-gray-600 mb-2">Neutral</p>
                  <p className="text-3xl font-bold">{data.feedbackAnalysis.sentimentBreakdown.neutral}</p>
                  <p className="text-sm mt-1">
                    {data.feedbackAnalysis.totalFeedbacks > 0 
                      ? ((data.feedbackAnalysis.sentimentBreakdown.neutral / data.feedbackAnalysis.totalFeedbacks) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                  <p className="text-sm text-red-600 mb-2">Negative</p>
                  <p className="text-3xl font-bold">{data.feedbackAnalysis.sentimentBreakdown.negative}</p>
                  <p className="text-sm mt-1">
                    {data.feedbackAnalysis.totalFeedbacks > 0 
                      ? ((data.feedbackAnalysis.sentimentBreakdown.negative / data.feedbackAnalysis.totalFeedbacks) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Common Themes */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Common Feedback Themes</h3>
              <div className="space-y-3">
                {data.feedbackAnalysis.commonThemes.map((theme, index) => (
                  <div key={index} className={`p-3 rounded flex justify-between items-center ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                    <span className="capitalize font-medium">{theme.theme}</span>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs ${theme.sentiment === 'positive' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {theme.sentiment}
                      </span>
                      <span className="text-sm font-medium">{theme.count} mentions</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Feedback */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Recent Feedback</h3>
              <div className="space-y-4">
                {data.feedbackAnalysis.recentFeedback.map((feedback, index) => (
                  <div key={index} className={`p-4 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm">{feedback.date}</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={`text-sm ${star <= feedback.rating ? 'text-yellow-400' : 'text-gray-400'}`}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{feedback.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TeacherPerformanceReport;
