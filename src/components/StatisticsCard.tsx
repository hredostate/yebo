import React from 'react';

interface StatisticsCardProps {
    icon: string;
    label: string;
    value: string | number;
    subtitle?: string;
    bgColor?: string;
    textColor?: string;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({
    icon,
    label,
    value,
    subtitle,
    bgColor = 'bg-white',
    textColor = 'text-slate-900'
}) => {
    return (
        <div className={`${bgColor} rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{icon}</span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
            </div>
            <div className={`text-3xl font-bold ${textColor} dark:text-white`}>
                {value}
            </div>
            {subtitle && (
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {subtitle}
                </div>
            )}
        </div>
    );
};

export default StatisticsCard;
