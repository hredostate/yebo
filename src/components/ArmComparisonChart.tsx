import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import type { ArmStatistics } from '../types';

interface ArmComparisonChartProps {
    arms: ArmStatistics[];
    title?: string;
}

const ARM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const ArmComparisonChart: React.FC<ArmComparisonChartProps> = ({ arms, title = 'Arm Performance Comparison' }) => {
    if (!arms || arms.length === 0) {
        return (
            <div className="text-center p-8 text-slate-500">
                No arm comparison data available
            </div>
        );
    }

    const chartData = arms.map((arm) => ({
        name: arm.arm_name,
        'Average Score': arm.average_score,
        'Highest Score': arm.highest_score,
        'Pass Rate': arm.pass_rate,
        students: arm.student_count,
    }));

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">{title}</h3>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                        dataKey="name" 
                        stroke="#64748b"
                        style={{ fontSize: '14px' }}
                    />
                    <YAxis 
                        stroke="#64748b"
                        style={{ fontSize: '14px' }}
                        domain={[0, 100]}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #475569',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                        formatter={(value: any, name: string) => {
                            if (name === 'Pass Rate') return [`${value.toFixed(1)}%`, name];
                            return [value.toFixed(2), name];
                        }}
                    />
                    <Legend />
                    <Bar dataKey="Average Score" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Highest Score" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Pass Rate" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {arms.map((arm, index) => (
                    <div 
                        key={arm.arm_name} 
                        className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div 
                                className="w-3 h-3 rounded" 
                                style={{ backgroundColor: ARM_COLORS[index % ARM_COLORS.length] }}
                            />
                            <span className="font-semibold text-slate-900 dark:text-white">{arm.arm_name}</span>
                        </div>
                        <div className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                            <div>Students: {arm.student_count}</div>
                            <div>Average: {arm.average_score.toFixed(2)}%</div>
                            <div>Pass Rate: {arm.pass_rate.toFixed(1)}%</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ArmComparisonChart;
