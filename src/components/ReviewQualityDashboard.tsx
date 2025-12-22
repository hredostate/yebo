import React, { useState, useMemo } from 'react';
import type { LessonPlanReviewEvidence, UserProfile } from '../types';
import { ChartBarIcon, ExclamationTriangleIcon, CheckCircleIcon } from './common/icons';

// Quality threshold constants
const MIN_ACTIVE_TIME_THRESHOLD = 45; // seconds
const MIN_SCROLL_DEPTH_THRESHOLD = 50; // percentage
const MAX_PAUSE_COUNT_THRESHOLD = 5; // number of pauses
const HIGH_APPROVAL_RATE_THRESHOLD = 95; // percentage
const HIGH_SIMILAR_FEEDBACK_THRESHOLD = 3; // count

interface ReviewQualityDashboardProps {
    reviewEvidence: LessonPlanReviewEvidence[];
    reviewers: UserProfile[];
    onViewReviewerDetails: (reviewerId: string) => void;
}

interface ReviewerMetrics {
    reviewer_id: string;
    reviewer_name: string;
    total_reviews: number;
    avg_time_spent: number;
    avg_active_time: number;
    avg_scroll_depth: number;
    avg_pause_count: number;
    avg_quality_given: number;
    approval_rate: number;
    similar_feedback_count: number;
    flags: string[];
}

const ReviewQualityDashboard: React.FC<ReviewQualityDashboardProps> = ({
    reviewEvidence,
    reviewers,
    onViewReviewerDetails
}) => {
    const [sortBy, setSortBy] = useState<keyof ReviewerMetrics>('total_reviews');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filterFlagged, setFilterFlagged] = useState(false);

    // Calculate metrics for each reviewer
    const reviewerMetrics = useMemo<ReviewerMetrics[]>(() => {
        const metricsMap = new Map<string, ReviewerMetrics>();

        reviewEvidence.forEach(review => {
            const reviewerId = review.reviewer_id;
            const reviewer = reviewers.find(r => r.id === reviewerId);
            
            if (!metricsMap.has(reviewerId)) {
                metricsMap.set(reviewerId, {
                    reviewer_id: reviewerId,
                    reviewer_name: reviewer?.name || 'Unknown',
                    total_reviews: 0,
                    avg_time_spent: 0,
                    avg_active_time: 0,
                    avg_scroll_depth: 0,
                    avg_pause_count: 0,
                    avg_quality_given: 0,
                    approval_rate: 0,
                    similar_feedback_count: 0,
                    flags: [],
                });
            }

            const metrics = metricsMap.get(reviewerId)!;
            metrics.total_reviews += 1;
            metrics.avg_time_spent += review.time_spent_seconds;
            metrics.avg_active_time += (review.active_review_time_seconds || 0);
            metrics.avg_scroll_depth += (review.scroll_depth_reached || 0);
            metrics.avg_pause_count += (review.pause_count || 0);
            metrics.avg_quality_given += review.quality_rating;
            if (review.decision === 'approved') {
                metrics.approval_rate += 1;
            }
            if (review.feedback_similarity_warning) {
                metrics.similar_feedback_count += 1;
            }
        });

        // Calculate averages and flag concerning patterns
        const metricsArray = Array.from(metricsMap.values()).map(metrics => {
            const total = metrics.total_reviews;
            metrics.avg_time_spent = Math.round(metrics.avg_time_spent / total);
            metrics.avg_active_time = Math.round(metrics.avg_active_time / total);
            metrics.avg_scroll_depth = Math.round(metrics.avg_scroll_depth / total);
            metrics.avg_pause_count = Math.round(metrics.avg_pause_count / total);
            metrics.avg_quality_given = Number((metrics.avg_quality_given / total).toFixed(1));
            metrics.approval_rate = Number(((metrics.approval_rate / total) * 100).toFixed(1));

            // Flag concerning patterns
            const flags: string[] = [];
            if (metrics.avg_active_time < MIN_ACTIVE_TIME_THRESHOLD) {
                flags.push('Low active time');
            }
            if (metrics.avg_scroll_depth < MIN_SCROLL_DEPTH_THRESHOLD) {
                flags.push('Low scroll depth');
            }
            if (metrics.avg_pause_count > MAX_PAUSE_COUNT_THRESHOLD) {
                flags.push('High pause count');
            }
            if (metrics.approval_rate > HIGH_APPROVAL_RATE_THRESHOLD) {
                flags.push('Very high approval rate');
            }
            if (metrics.similar_feedback_count > HIGH_SIMILAR_FEEDBACK_THRESHOLD) {
                flags.push('Repetitive feedback');
            }
            metrics.flags = flags;

            return metrics;
        });

        return metricsArray;
    }, [reviewEvidence, reviewers]);

    // Sort and filter metrics
    const sortedMetrics = useMemo(() => {
        let filtered = filterFlagged 
            ? reviewerMetrics.filter(m => m.flags.length > 0)
            : reviewerMetrics;

        return filtered.sort((a, b) => {
            const aVal = a[sortBy];
            const bVal = b[sortBy];
            
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortOrder === 'asc' 
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }
            
            const aNum = Array.isArray(aVal) ? aVal.length : Number(aVal);
            const bNum = Array.isArray(bVal) ? bVal.length : Number(bVal);
            
            return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
        });
    }, [reviewerMetrics, sortBy, sortOrder, filterFlagged]);

    const handleSort = (column: keyof ReviewerMetrics) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const exportReport = () => {
        // Helper function to escape CSV values
        const escapeCsvValue = (value: any): string => {
            const str = String(value);
            // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        
        const csv = [
            ['Reviewer', 'Total Reviews', 'Avg Time (s)', 'Avg Active Time (s)', 'Avg Scroll %', 'Avg Pauses', 'Avg Rating', 'Approval %', 'Similar Feedbacks', 'Flags'],
            ...sortedMetrics.map(m => [
                escapeCsvValue(m.reviewer_name),
                escapeCsvValue(m.total_reviews),
                escapeCsvValue(m.avg_time_spent),
                escapeCsvValue(m.avg_active_time),
                escapeCsvValue(m.avg_scroll_depth),
                escapeCsvValue(m.avg_pause_count),
                escapeCsvValue(m.avg_quality_given),
                escapeCsvValue(m.approval_rate),
                escapeCsvValue(m.similar_feedback_count),
                escapeCsvValue(m.flags.join('; '))
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `review-quality-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const flaggedCount = reviewerMetrics.filter(m => m.flags.length > 0).length;

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <ChartBarIcon className="w-8 h-8" />
                        Review Quality Dashboard
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Monitor review quality and identify concerning patterns
                    </p>
                </div>
                <button
                    onClick={exportReport}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Export Report
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <CheckCircleIcon className="w-8 h-8 text-green-500" />
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Total Reviewers</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                {reviewerMetrics.length}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Flagged Reviewers</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                {flaggedCount}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <ChartBarIcon className="w-8 h-8 text-blue-500" />
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Total Reviews</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                {reviewEvidence.length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Toggle */}
            <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={filterFlagged}
                        onChange={(e) => setFilterFlagged(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                        Show only flagged reviewers
                    </span>
                </label>
            </div>

            {/* Metrics Table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                {[
                                    { key: 'reviewer_name' as keyof ReviewerMetrics, label: 'Reviewer' },
                                    { key: 'total_reviews' as keyof ReviewerMetrics, label: 'Reviews' },
                                    { key: 'avg_active_time' as keyof ReviewerMetrics, label: 'Active Time (s)' },
                                    { key: 'avg_scroll_depth' as keyof ReviewerMetrics, label: 'Scroll %' },
                                    { key: 'avg_pause_count' as keyof ReviewerMetrics, label: 'Pauses' },
                                    { key: 'avg_quality_given' as keyof ReviewerMetrics, label: 'Avg Rating' },
                                    { key: 'approval_rate' as keyof ReviewerMetrics, label: 'Approval %' },
                                    { key: 'similar_feedback_count' as keyof ReviewerMetrics, label: 'Similar' },
                                    { key: 'flags' as keyof ReviewerMetrics, label: 'Flags' },
                                ].map(col => (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSort(col.key)}
                                        className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        {col.label}
                                        {sortBy === col.key && (
                                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {sortedMetrics.map(metrics => (
                                <tr
                                    key={metrics.reviewer_id}
                                    className={`${
                                        metrics.flags.length > 0
                                            ? 'bg-yellow-50 dark:bg-yellow-900/10'
                                            : 'bg-white dark:bg-slate-800'
                                    } hover:bg-slate-50 dark:hover:bg-slate-750`}
                                >
                                    <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {metrics.reviewer_name}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                        {metrics.total_reviews}
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${
                                        metrics.avg_active_time < MIN_ACTIVE_TIME_THRESHOLD
                                            ? 'text-red-600 dark:text-red-400 font-medium'
                                            : 'text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {metrics.avg_active_time}
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${
                                        metrics.avg_scroll_depth < MIN_SCROLL_DEPTH_THRESHOLD
                                            ? 'text-red-600 dark:text-red-400 font-medium'
                                            : 'text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {metrics.avg_scroll_depth}%
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${
                                        metrics.avg_pause_count > MAX_PAUSE_COUNT_THRESHOLD
                                            ? 'text-yellow-600 dark:text-yellow-400 font-medium'
                                            : 'text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {metrics.avg_pause_count}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                        {metrics.avg_quality_given}
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${
                                        metrics.approval_rate > HIGH_APPROVAL_RATE_THRESHOLD
                                            ? 'text-yellow-600 dark:text-yellow-400 font-medium'
                                            : 'text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {metrics.approval_rate}%
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${
                                        metrics.similar_feedback_count > HIGH_SIMILAR_FEEDBACK_THRESHOLD
                                            ? 'text-red-600 dark:text-red-400 font-medium'
                                            : 'text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {metrics.similar_feedback_count}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {metrics.flags.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {metrics.flags.map((flag, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded"
                                                    >
                                                        {flag}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-green-600 dark:text-green-400">✓</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <button
                                            onClick={() => onViewReviewerDetails(metrics.reviewer_id)}
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {sortedMetrics.length === 0 && (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    No review data available
                </div>
            )}
        </div>
    );
};

export default ReviewQualityDashboard;
