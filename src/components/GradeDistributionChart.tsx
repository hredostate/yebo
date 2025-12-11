import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { GradeDistribution } from '../types';

interface GradeDistributionChartProps {
    data: GradeDistribution[];
    title?: string;
}

const GRADE_COLORS: Record<string, string> = {
    'A': '#10b981', // green
    'B': '#3b82f6', // blue
    'C': '#f59e0b', // amber
    'D': '#f97316', // orange
    'E': '#ef4444', // red
    'F': '#dc2626', // dark red
};

const GradeDistributionChart: React.FC<GradeDistributionChartProps> = ({ data, title = 'Grade Distribution' }) => {
    if (!data || data.length === 0) {
        return (
            <div className="text-center p-8 text-slate-500">
                No grade distribution data available
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                        dataKey="grade_label" 
                        stroke="#64748b"
                        style={{ fontSize: '14px' }}
                    />
                    <YAxis 
                        stroke="#64748b"
                        style={{ fontSize: '14px' }}
                        allowDecimals={false}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #475569',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                        formatter={(value: any, name: string) => {
                            if (name === 'count') return [value, 'Students'];
                            if (name === 'percentage') return [`${value}%`, 'Percentage'];
                            return [value, name];
                        }}
                    />
                    <Bar dataKey="count" name="count" radius={[8, 8, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={GRADE_COLORS[entry.grade_label] || '#94a3b8'} 
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {data.map((item) => (
                    <div key={item.grade_label} className="text-center text-sm">
                        <div className="flex items-center justify-center gap-1">
                            <div 
                                className="w-3 h-3 rounded" 
                                style={{ backgroundColor: GRADE_COLORS[item.grade_label] || '#94a3b8' }}
                            />
                            <span className="font-semibold">{item.grade_label}</span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-400">
                            {item.count} ({item.percentage.toFixed(1)}%)
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GradeDistributionChart;
