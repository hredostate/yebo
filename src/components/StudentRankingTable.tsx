import React, { useState, useMemo } from 'react';
import type { StudentRanking } from '../types';
import { DownloadIcon, SearchIcon } from './common/icons';
import { exportToCsv } from '../utils/export';

interface StudentRankingTableProps {
    rankings: StudentRanking[];
    title?: string;
    showArmColumn?: boolean;
}

const StudentRankingTable: React.FC<StudentRankingTableProps> = ({ 
    rankings, 
    title = 'Student Rankings',
    showArmColumn = true 
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<keyof StudentRanking>('rank');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const itemsPerPage = 20;

    // Filter rankings based on search
    const filteredRankings = useMemo(() => {
        if (!searchQuery.trim()) return rankings;
        
        const query = searchQuery.toLowerCase();
        return rankings.filter(r => 
            r.student_name.toLowerCase().includes(query) ||
            r.admission_number?.toLowerCase().includes(query) ||
            r.class_name.toLowerCase().includes(query) ||
            r.arm_name.toLowerCase().includes(query)
        );
    }, [rankings, searchQuery]);

    // Sort rankings
    const sortedRankings = useMemo(() => {
        const sorted = [...filteredRankings];
        sorted.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === 'asc' 
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }
            
            const aNum = Number(aVal) || 0;
            const bNum = Number(bVal) || 0;
            return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        });
        return sorted;
    }, [filteredRankings, sortField, sortDirection]);

    // Paginate
    const paginatedRankings = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedRankings.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedRankings, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedRankings.length / itemsPerPage);

    const handleSort = (field: keyof StudentRanking) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleExport = () => {
        const exportData = sortedRankings.map(r => {
            const baseData = {
                Rank: r.rank,
                'Student Name': r.student_name,
                'Admission No': r.admission_number || 'N/A',
                Class: r.class_name,
                'Average %': r.average_score.toFixed(2),
                'Total Score': r.total_score.toFixed(2),
                Grade: r.grade_label
            };
            
            if (showArmColumn) {
                return {
                    Rank: baseData.Rank,
                    'Student Name': baseData['Student Name'],
                    'Admission No': baseData['Admission No'],
                    Class: baseData.Class,
                    Arm: r.arm_name,
                    'Average %': baseData['Average %'],
                    'Total Score': baseData['Total Score'],
                    Grade: baseData.Grade
                };
            }
            
            return baseData;
        });
        
        exportToCsv(exportData, `student-rankings-${Date.now()}.csv`);
    };

    const getRankBadgeColor = (rank: number) => {
        if (rank === 1) return 'bg-yellow-400 text-yellow-900'; // Gold
        if (rank === 2) return 'bg-gray-300 text-gray-900'; // Silver
        if (rank === 3) return 'bg-amber-600 text-white'; // Bronze
        return 'bg-slate-200 text-slate-700';
    };

    const getPositionChangeIndicator = (change?: number) => {
        if (change === undefined || change === null) return null;
        if (change > 0) return <span className="text-green-600 text-xs">↑ {change}</span>;
        if (change < 0) return <span className="text-red-600 text-xs">↓ {Math.abs(change)}</span>;
        return <span className="text-slate-400 text-xs">─</span>;
    };

    const getRowClassName = (rank: number, totalRankings: number) => {
        const isBottom = rank > totalRankings - 3 && totalRankings > 10;
        const isTop3 = rank <= 3;
        
        if (isTop3) return 'bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20';
        if (isBottom) return 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20';
        return 'hover:bg-slate-50 dark:hover:bg-slate-800/50';
    };

    if (!rankings || rankings.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                <p className="text-slate-500">No ranking data available</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            placeholder="Search students..."
                            className="pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700"
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                        <tr>
                            <th 
                                className="p-3 text-left cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                                onClick={() => handleSort('rank')}
                            >
                                Rank {sortField === 'rank' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th 
                                className="p-3 text-left cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                                onClick={() => handleSort('student_name')}
                            >
                                Student Name {sortField === 'student_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-3 text-left">Admission No</th>
                            <th className="p-3 text-left">Class</th>
                            {showArmColumn && <th className="p-3 text-left">Arm</th>}
                            <th 
                                className="p-3 text-right cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                                onClick={() => handleSort('average_score')}
                            >
                                Average % {sortField === 'average_score' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th 
                                className="p-3 text-right cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                                onClick={() => handleSort('total_score')}
                            >
                                Total Score {sortField === 'total_score' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-3 text-center">Grade</th>
                            <th className="p-3 text-center">Change</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {paginatedRankings.map((ranking) => (
                            <tr 
                                key={ranking.student_id} 
                                className={getRowClassName(ranking.rank, rankings.length)}
                            >
                                <td className="p-3">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${getRankBadgeColor(ranking.rank)}`}>
                                        {ranking.rank}
                                    </span>
                                </td>
                                <td className="p-3 font-medium text-slate-900 dark:text-white">
                                    {ranking.student_name}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-400">
                                    {ranking.admission_number || 'N/A'}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-400">
                                    {ranking.class_name}
                                </td>
                                {showArmColumn && (
                                    <td className="p-3 text-slate-600 dark:text-slate-400">
                                        {ranking.arm_name}
                                    </td>
                                )}
                                <td className="p-3 text-right font-semibold text-slate-900 dark:text-white">
                                    {ranking.average_score.toFixed(2)}%
                                </td>
                                <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                                    {ranking.total_score.toFixed(2)}
                                </td>
                                <td className="p-3 text-center">
                                    <span className="inline-block px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 font-medium">
                                        {ranking.grade_label}
                                    </span>
                                </td>
                                <td className="p-3 text-center">
                                    {getPositionChangeIndicator(ranking.position_change)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedRankings.length)} of {sortedRankings.length} students
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            Previous
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                                            currentPage === pageNum
                                                ? 'bg-blue-600 text-white'
                                                : 'border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentRankingTable;
