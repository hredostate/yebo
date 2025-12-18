import React, { useState, useMemo } from 'react';
import type { LevelRankingResult } from '../types';
import { SearchIcon, DownloadIcon } from './common/icons';
import { exportToCsv } from '../utils/export';

interface EnhancedRankingTableProps {
    rankings: LevelRankingResult[];
    title: string;
    showArmColumn?: boolean;
}

type SortField = 'rank' | 'name' | 'average_score' | 'total_score' | 'subjects_count' | 'arm';
type SortDirection = 'asc' | 'desc';

const EnhancedRankingTable: React.FC<EnhancedRankingTableProps> = ({
    rankings,
    title,
    showArmColumn = true
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('rank');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Calculate total columns for dynamic colspan
    const totalColumns = showArmColumn ? 8 : 7;

    // Filter rankings based on search
    const filteredRankings = useMemo(() => {
        if (!searchQuery.trim()) return rankings;
        
        const query = searchQuery.toLowerCase();
        return rankings.filter(r => 
            r.name.toLowerCase().includes(query) ||
            r.admission_number?.toLowerCase().includes(query) ||
            r.arm.toLowerCase().includes(query)
        );
    }, [rankings, searchQuery]);

    // Sort rankings
    const sortedRankings = useMemo(() => {
        const sorted = [...filteredRankings];
        
        sorted.sort((a, b) => {
            let aValue: any;
            let bValue: any;
            
            switch (sortField) {
                case 'rank':
                    // Treat null ranks as a very large number so they sort to the end
                    aValue = a.level_rank ?? Number.MAX_SAFE_INTEGER;
                    bValue = b.level_rank ?? Number.MAX_SAFE_INTEGER;
                    break;
                case 'name':
                    aValue = a.name;
                    bValue = b.name;
                    break;
                case 'average_score':
                    aValue = a.average_score;
                    bValue = b.average_score;
                    break;
                case 'total_score':
                    aValue = a.total_score;
                    bValue = b.total_score;
                    break;
                case 'subjects_count':
                    aValue = a.subjects_count;
                    bValue = b.subjects_count;
                    break;
                case 'arm':
                    aValue = a.arm;
                    bValue = b.arm;
                    break;
                default:
                    return 0;
            }
            
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        
        return sorted;
    }, [filteredRankings, sortField, sortDirection]);

    // Paginate rankings
    const paginatedRankings = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return sortedRankings.slice(startIndex, endIndex);
    }, [sortedRankings, currentPage]);

    const totalPages = Math.ceil(sortedRankings.length / itemsPerPage);

    // Handle sort
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Export to CSV
    const handleExport = () => {
        const exportData = sortedRankings.map(r => ({
            'Rank': r.level_rank ?? 'N/A',
            'Name': r.name,
            'Admission Number': r.admission_number || '',
            'Arm': r.arm,
            'Average Score': r.average_score.toFixed(2),
            'Total Score': r.total_score.toFixed(2),
            'Subjects': r.subjects_count,
            'Percentile': r.level_percentile ? `${r.level_percentile.toFixed(1)}%` : 'N/A',
            'Grade Distribution': Object.entries(r.grade_counts)
                .map(([grade, count]) => `${grade}:${count}`)
                .join(', '),
            'Rank Status': r.is_ranked ? 'Ranked' : (r.rank_reason || 'Not Ranked')
        }));
        
        exportToCsv(exportData, `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.csv`);
    };

    // Get medal for top 3
    const getMedal = (rank: number | null) => {
        if (rank === null) return null;
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return null;
    };

    // Render sort icon
    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
            );
        }
        
        return sortDirection === 'asc' ? (
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
        ) : (
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {sortedRankings.length} student{sortedRankings.length !== 1 ? 's' : ''}
                            {searchQuery && ` matching "${searchQuery}"`}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search students..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-9 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                        </div>
                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th 
                                className="p-3 text-left font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={() => handleSort('rank')}
                            >
                                <div className="flex items-center gap-2">
                                    Rank
                                    <SortIcon field="rank" />
                                </div>
                            </th>
                            <th 
                                className="p-3 text-left font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={() => handleSort('name')}
                            >
                                <div className="flex items-center gap-2">
                                    Student
                                    <SortIcon field="name" />
                                </div>
                            </th>
                            {showArmColumn && (
                                <th 
                                    className="p-3 text-left font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    onClick={() => handleSort('arm')}
                                >
                                    <div className="flex items-center gap-2">
                                        Arm
                                        <SortIcon field="arm" />
                                    </div>
                                </th>
                            )}
                            <th 
                                className="p-3 text-center font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={() => handleSort('subjects_count')}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    Subjects
                                    <SortIcon field="subjects_count" />
                                </div>
                            </th>
                            <th 
                                className="p-3 text-right font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={() => handleSort('average_score')}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Average
                                    <SortIcon field="average_score" />
                                </div>
                            </th>
                            <th 
                                className="p-3 text-right font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={() => handleSort('total_score')}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Total
                                    <SortIcon field="total_score" />
                                </div>
                            </th>
                            <th className="p-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                                Grades
                            </th>
                            <th className="p-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                                Percentile
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {paginatedRankings.length === 0 ? (
                            <tr>
                                <td colSpan={totalColumns} className="p-8 text-center text-slate-500 dark:text-slate-400">
                                    {searchQuery ? 'No students found matching your search' : 'No students to display'}
                                </td>
                            </tr>
                        ) : (
                            paginatedRankings.map((ranking) => {
                                const medal = getMedal(ranking.level_rank);
                                const isTopThree = ranking.level_rank && ranking.level_rank <= 3;
                                const rowClass = isTopThree ? 'bg-amber-50 dark:bg-amber-900/10' : '';
                                
                                return (
                                    <tr key={ranking.student_id} className={`${rowClass} hover:bg-slate-50 dark:hover:bg-slate-800/50`}>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                {medal && <span className="text-xl">{medal}</span>}
                                                <span className={`font-semibold ${isTopThree ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                                    {ranking.level_rank ?? '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div>
                                                <div className="font-medium text-slate-900 dark:text-white">
                                                    {ranking.name}
                                                </div>
                                                {ranking.admission_number && (
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        {ranking.admission_number}
                                                    </div>
                                                )}
                                                {!ranking.is_ranked && ranking.rank_reason && (
                                                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                                        {ranking.rank_reason}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        {showArmColumn && (
                                            <td className="p-3 text-slate-700 dark:text-slate-300">
                                                {ranking.arm}
                                            </td>
                                        )}
                                        <td className="p-3 text-center text-slate-700 dark:text-slate-300">
                                            {ranking.subjects_count}
                                        </td>
                                        <td className="p-3 text-right font-semibold text-slate-900 dark:text-white">
                                            {ranking.average_score.toFixed(2)}%
                                        </td>
                                        <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                                            {ranking.total_score.toFixed(2)}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap gap-1 justify-center">
                                                {Object.entries(ranking.grade_counts).map(([grade, count]) => (
                                                    count > 0 && (
                                                        <span 
                                                            key={grade}
                                                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                                        >
                                                            {grade}: {count}
                                                        </span>
                                                    )
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            {ranking.level_percentile ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {ranking.level_percentile.toFixed(1)}%
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedRankings.length)} of {sortedRankings.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-sm font-medium rounded-md bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(page => {
                                        // Show first, last, current, and pages around current
                                        return page === 1 || 
                                               page === totalPages || 
                                               Math.abs(page - currentPage) <= 1;
                                    })
                                    .map((page, idx, arr) => (
                                        <React.Fragment key={page}>
                                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                                                <span className="px-2 text-slate-400">...</span>
                                            )}
                                            <button
                                                onClick={() => setCurrentPage(page)}
                                                className={`px-3 py-1 text-sm font-medium rounded-md ${
                                                    currentPage === page
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        </React.Fragment>
                                    ))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-sm font-medium rounded-md bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnhancedRankingTable;
