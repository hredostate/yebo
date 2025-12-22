import React, { useState, useEffect, useMemo } from 'react';
import { 
    ChartBarIcon, 
    CheckCircleIcon, 
    ClockIcon,
    ExclamationCircleIcon,
    TrendingUpIcon,
    BookOpenIcon
} from './common/icons';
import type { LessonPlan, LessonPlanCoverage } from '../types';
import { requireSupabaseClient } from '../services/supabaseClient';

const UNKNOWN_SUBJECT = 'Unknown';

interface CoverageAnalyticsDashboardProps {
    schoolId: number;
    lessonPlans: LessonPlan[];
    coverageData: LessonPlanCoverage[];
    addToast: (message: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

interface SubjectCoverage {
    subject: string;
    totalPlans: number;
    fullyCovered: number;
    partiallyCovered: number;
    notCovered: number;
    avgPercentage: number;
}

interface WeeklyTrend {
    weekStart: string;
    submitted: number;
    covered: number;
}

const CoverageAnalyticsDashboard: React.FC<CoverageAnalyticsDashboardProps> = ({
    schoolId,
    lessonPlans,
    coverageData,
    addToast
}) => {
    const [loading, setLoading] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

    // Overall Statistics
    const overallStats = useMemo(() => {
        // Filter for approved/published plans
        const relevantPlans = lessonPlans.filter(p => 
            p.status === 'approved' || p.status === 'published'
        );
        
        const totalPlans = relevantPlans.length;
        const plansWithCoverage = new Set(coverageData.map(c => c.lesson_plan_id));
        
        const fullyCovered = coverageData.filter(c => c.coverage_status === 'Fully Covered').length;
        const partiallyCovered = coverageData.filter(c => c.coverage_status === 'Partially Covered').length;
        const notCovered = coverageData.filter(c => c.coverage_status === 'Not Covered' || c.coverage_status === 'not_started').length;
        const inProgress = coverageData.filter(c => c.coverage_status === 'Pending').length;
        
        const avgPercentage = coverageData.length > 0
            ? coverageData.reduce((sum, c) => sum + (c.coverage_percentage || 0), 0) / coverageData.length
            : 0;

        return {
            totalPlans,
            fullyCovered,
            partiallyCovered,
            notCovered,
            inProgress,
            avgPercentage: Math.round(avgPercentage),
            notStarted: totalPlans - plansWithCoverage.size
        };
    }, [lessonPlans, coverageData]);

    // Subject-wise Coverage Breakdown
    const subjectCoverageData = useMemo(() => {
        const subjectMap = new Map<string, SubjectCoverage>();

        // Process lesson plans
        lessonPlans.forEach(plan => {
            if (plan.status !== 'approved' && plan.status !== 'published') return;
            
            const subject = plan.subject || UNKNOWN_SUBJECT;
            if (!subjectMap.has(subject)) {
                subjectMap.set(subject, {
                    subject,
                    totalPlans: 0,
                    fullyCovered: 0,
                    partiallyCovered: 0,
                    notCovered: 0,
                    avgPercentage: 0
                });
            }
            
            const data = subjectMap.get(subject)!;
            data.totalPlans++;
            
            // Find coverage for this plan
            const coverage = coverageData.filter(c => c.lesson_plan_id === plan.id);
            if (coverage.length > 0) {
                coverage.forEach(c => {
                    if (c.coverage_status === 'Fully Covered') data.fullyCovered++;
                    else if (c.coverage_status === 'Partially Covered') data.partiallyCovered++;
                    else data.notCovered++;
                });
            } else {
                data.notCovered++;
            }
        });

        // Calculate average percentages
        subjectMap.forEach((data, subject) => {
            const relevantCoverage = coverageData.filter(c => {
                const plan = lessonPlans.find(p => p.id === c.lesson_plan_id);
                return plan && plan.subject === subject;
            });
            
            if (relevantCoverage.length > 0) {
                const sum = relevantCoverage.reduce((acc, c) => acc + (c.coverage_percentage || 0), 0);
                data.avgPercentage = Math.round(sum / relevantCoverage.length);
            }
        });

        return Array.from(subjectMap.values()).sort((a, b) => a.subject.localeCompare(b.subject));
    }, [lessonPlans, coverageData]);

    // Weekly Trend (last 8 weeks)
    const weeklyTrend = useMemo(() => {
        const trends = new Map<string, WeeklyTrend>();
        const now = new Date();
        
        // Helper to calculate week start date
        const getWeekStartDate = (daysOffset: number): string => {
            const weekStart = new Date(now);
            const currentDayOfWeek = weekStart.getDay();
            const daysToSubtract = currentDayOfWeek + daysOffset;
            weekStart.setDate(weekStart.getDate() - daysToSubtract);
            return weekStart.toISOString().split('T')[0];
        };
        
        // Generate last 8 weeks
        for (let i = 7; i >= 0; i--) {
            const weekKey = getWeekStartDate(7 * i);
            trends.set(weekKey, {
                weekStart: weekKey,
                submitted: 0,
                covered: 0
            });
        }

        // Count submitted plans
        lessonPlans.forEach(plan => {
            if (plan.status === 'approved' || plan.status === 'published') {
                const weekKey = plan.week_start_date;
                if (trends.has(weekKey)) {
                    trends.get(weekKey)!.submitted++;
                }
            }
        });

        // Count covered plans
        coverageData.forEach(coverage => {
            if (coverage.coverage_status === 'Fully Covered') {
                const plan = lessonPlans.find(p => p.id === coverage.lesson_plan_id);
                if (plan && plan.week_start_date) {
                    const weekKey = plan.week_start_date;
                    if (trends.has(weekKey)) {
                        trends.get(weekKey)!.covered++;
                    }
                }
            }
        });

        return Array.from(trends.values());
    }, [lessonPlans, coverageData]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Fully Covered':
                return 'bg-green-500';
            case 'Partially Covered':
                return 'bg-yellow-500';
            case 'Not Covered':
            case 'not_started':
                return 'bg-red-500';
            case 'Pending':
                return 'bg-blue-500';
            default:
                return 'bg-gray-500';
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ChartBarIcon className="w-6 h-6" />
                    Coverage Analytics Dashboard
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Track lesson plan coverage across all subjects and classes
                </p>
            </div>

            {/* Overall Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Plans</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{overallStats.totalPlans}</p>
                        </div>
                        <BookOpenIcon className="w-8 h-8 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Fully Covered</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{overallStats.fullyCovered}</p>
                        </div>
                        <CheckCircleIcon className="w-8 h-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">In Progress</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{overallStats.inProgress}</p>
                        </div>
                        <ClockIcon className="w-8 h-8 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Not Started</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overallStats.notStarted}</p>
                        </div>
                        <ExclamationCircleIcon className="w-8 h-8 text-red-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Coverage</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{overallStats.avgPercentage}%</p>
                        </div>
                        <TrendingUpIcon className="w-8 h-8 text-purple-500" />
                    </div>
                </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Overall Progress
                </h2>
                <div className="relative h-8 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className="absolute h-full bg-green-500 transition-all duration-500"
                        style={{ width: `${(overallStats.fullyCovered / overallStats.totalPlans) * 100}%` }}
                    />
                    <div 
                        className="absolute h-full bg-yellow-500 transition-all duration-500"
                        style={{ 
                            left: `${(overallStats.fullyCovered / overallStats.totalPlans) * 100}%`,
                            width: `${(overallStats.partiallyCovered / overallStats.totalPlans) * 100}%` 
                        }}
                    />
                    <div 
                        className="absolute h-full bg-blue-500 transition-all duration-500"
                        style={{ 
                            left: `${((overallStats.fullyCovered + overallStats.partiallyCovered) / overallStats.totalPlans) * 100}%`,
                            width: `${(overallStats.inProgress / overallStats.totalPlans) * 100}%` 
                        }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-sm">
                    <span className="text-green-600 dark:text-green-400">
                        {overallStats.fullyCovered} Fully Covered
                    </span>
                    <span className="text-yellow-600 dark:text-yellow-400">
                        {overallStats.partiallyCovered} Partial
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                        {overallStats.inProgress} In Progress
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                        {overallStats.notStarted} Not Started
                    </span>
                </div>
            </div>

            {/* Subject-wise Breakdown */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Subject-wise Coverage
                </h2>
                <div className="space-y-4">
                    {subjectCoverageData.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                            No coverage data available
                        </p>
                    ) : (
                        subjectCoverageData.map(subject => (
                            <div key={subject.subject} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-medium text-gray-900 dark:text-white">
                                        {subject.subject}
                                    </h3>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {subject.totalPlans} plans • {subject.avgPercentage}% avg
                                    </span>
                                </div>
                                <div className="relative h-6 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                        className="absolute h-full bg-green-500"
                                        style={{ width: `${(subject.fullyCovered / subject.totalPlans) * 100}%` }}
                                    />
                                    <div 
                                        className="absolute h-full bg-yellow-500"
                                        style={{ 
                                            left: `${(subject.fullyCovered / subject.totalPlans) * 100}%`,
                                            width: `${(subject.partiallyCovered / subject.totalPlans) * 100}%` 
                                        }}
                                    />
                                </div>
                                <div className="flex gap-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                                    <span className="text-green-600 dark:text-green-400">
                                        {subject.fullyCovered} Covered
                                    </span>
                                    <span className="text-yellow-600 dark:text-yellow-400">
                                        {subject.partiallyCovered} Partial
                                    </span>
                                    <span className="text-red-600 dark:text-red-400">
                                        {subject.notCovered} Not Covered
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Weekly Trend Chart */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Weekly Trend (Last 8 Weeks)
                </h2>
                <div className="space-y-3">
                    {weeklyTrend.map(week => {
                        const coverageRate = week.submitted > 0 ? (week.covered / week.submitted) * 100 : 0;
                        return (
                            <div key={week.weekStart} className="flex items-center gap-4">
                                <span className="text-sm text-gray-600 dark:text-gray-400 w-20">
                                    {formatDate(week.weekStart)}
                                </span>
                                <div className="flex-1">
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1 h-8 bg-gray-200 dark:bg-slate-700 rounded-lg overflow-hidden">
                                            <div 
                                                className="h-full bg-blue-500"
                                                style={{ width: `${week.submitted > 0 ? 100 : 0}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-gray-600 dark:text-gray-400 w-16">
                                            {week.submitted} plans
                                        </span>
                                    </div>
                                    <div className="flex gap-2 items-center mt-1">
                                        <div className="flex-1 h-6 bg-gray-200 dark:bg-slate-700 rounded-lg overflow-hidden">
                                            <div 
                                                className="h-full bg-green-500"
                                                style={{ width: `${coverageRate}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-green-600 dark:text-green-400 w-16">
                                            {week.covered} covered
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CoverageAnalyticsDashboard;
