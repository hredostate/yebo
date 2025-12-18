import React, { useMemo } from 'react';
import type { SubjectAnalytics } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DownloadIcon } from './common/icons';
import { exportToCsv } from '../utils/export';

interface SubjectAnalyticsPanelProps {
    subjectAnalytics: SubjectAnalytics[];
    title?: string;
}

const SubjectAnalyticsPanel: React.FC<SubjectAnalyticsPanelProps> = ({
    subjectAnalytics,
    title = 'Subject Performance Analysis'
}) => {
    // Sort subjects by average score
    const sortedSubjects = useMemo(() => {
        return [...subjectAnalytics].sort((a, b) => b.avg_score - a.avg_score);
    }, [subjectAnalytics]);

    // Prepare chart data
    const chartData = useMemo(() => {
        return sortedSubjects.map(s => ({
            subject: s.subject.length > 15 ? s.subject.substring(0, 12) + '...' : s.subject,
            fullSubject: s.subject,
            average: parseFloat(s.avg_score.toFixed(2)),
            failRate: parseFloat(s.fail_rate.toFixed(2))
        }));
    }, [sortedSubjects]);

    // Get color based on performance
    const getBarColor = (value: number, index: number) => {
        if (index < 3) return '#10b981'; // Top 3 - green
        if (index >= sortedSubjects.length - 3) return '#ef4444'; // Bottom 3 - red
        if (value >= 70) return '#3b82f6'; // Good - blue
        if (value >= 50) return '#f59e0b'; // Average - amber
        return '#ef4444'; // Poor - red
    };

    // Export to CSV
    const handleExport = () => {
        const exportData = sortedSubjects.map(s => ({
            'Subject': s.subject,
            'Average Score': s.avg_score.toFixed(2),
            'Highest Score': s.max_score.toFixed(2),
            'Lowest Score': s.min_score.toFixed(2),
            'Student Count': s.student_count,
            'Fail Count': s.fail_count,
            'Fail Rate (%)': s.fail_rate.toFixed(2)
        }));
        
        exportToCsv(exportData, `subject-analytics-${Date.now()}.csv`);
    };

    // Custom tooltip for chart
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
                    <p className="font-semibold text-slate-900 dark:text-white mb-1">
                        {payload[0].payload.fullSubject}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                        Average: {payload[0].value}%
                    </p>
                </div>
            );
        }
        return null;
    };

    if (subjectAnalytics.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
                <div className="text-center text-slate-500 dark:text-slate-400">
                    No subject data available
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {sortedSubjects.length} subject{sortedSubjects.length !== 1 ? 's' : ''} analyzed
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
                >
                    <DownloadIcon className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Chart */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                    Average Scores by Subject
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis 
                            dataKey="subject" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            tick={{ fill: '#64748b', fontSize: 12 }}
                        />
                        <YAxis 
                            domain={[0, 100]}
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            label={{ value: 'Average Score (%)', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="average" radius={[8, 8, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getBarColor(entry.average, index)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                                    Subject
                                </th>
                                <th className="p-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                                    Avg Score
                                </th>
                                <th className="p-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                                    Highest
                                </th>
                                <th className="p-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                                    Lowest
                                </th>
                                <th className="p-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                                    Students
                                </th>
                                <th className="p-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                                    Fail Count
                                </th>
                                <th className="p-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                                    Fail Rate
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {sortedSubjects.map((subject, idx) => {
                                const isTopPerformer = idx < 3;
                                const isBottomPerformer = idx >= sortedSubjects.length - 3 && sortedSubjects.length > 5;
                                const hasHighFailRate = subject.fail_rate > 50;
                                
                                let rowClass = '';
                                if (isTopPerformer) rowClass = 'bg-green-50 dark:bg-green-900/10';
                                else if (isBottomPerformer || hasHighFailRate) rowClass = 'bg-red-50 dark:bg-red-900/10';
                                
                                return (
                                    <tr key={subject.subject} className={`${rowClass} hover:bg-slate-50 dark:hover:bg-slate-800/50`}>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                {isTopPerformer && <span className="text-green-600 dark:text-green-400">🏆</span>}
                                                {isBottomPerformer && <span className="text-red-600 dark:text-red-400">⚠️</span>}
                                                {hasHighFailRate && !isBottomPerformer && <span className="text-amber-600 dark:text-amber-400">⚡</span>}
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {subject.subject}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className={`font-semibold ${
                                                subject.avg_score >= 70 ? 'text-green-600 dark:text-green-400' :
                                                subject.avg_score >= 50 ? 'text-blue-600 dark:text-blue-400' :
                                                subject.avg_score >= 40 ? 'text-amber-600 dark:text-amber-400' :
                                                'text-red-600 dark:text-red-400'
                                            }`}>
                                                {subject.avg_score.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">
                                            {subject.max_score.toFixed(2)}%
                                        </td>
                                        <td className="p-3 text-right text-red-600 dark:text-red-400 font-medium">
                                            {subject.min_score.toFixed(2)}%
                                        </td>
                                        <td className="p-3 text-center text-slate-700 dark:text-slate-300">
                                            {subject.student_count}
                                        </td>
                                        <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                                            {subject.fail_count}
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                subject.fail_rate >= 50 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                                subject.fail_rate >= 30 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                                                subject.fail_rate >= 10 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                                'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                            }`}>
                                                {subject.fail_rate.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex flex-wrap gap-6 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-green-600 dark:text-green-400">🏆</span>
                        <span className="text-slate-700 dark:text-slate-300">Top 3 performing subjects</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-red-600 dark:text-red-400">⚠️</span>
                        <span className="text-slate-700 dark:text-slate-300">Bottom 3 performing subjects</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-amber-600 dark:text-amber-400">⚡</span>
                        <span className="text-slate-700 dark:text-slate-300">High fail rate (&gt;50%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubjectAnalyticsPanel;
