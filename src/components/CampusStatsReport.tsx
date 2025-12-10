import React, { useState, useEffect } from 'react';
import {
  getCampuses,
  getAllCampusesStats,
  getCampusStats,
  exportToCSV,
  type CampusStats,
  type Campus,
} from '../services/campusAnalytics';
import type { UserProfile, Term } from '../types';

interface CampusStatsReportProps {
  userProfile: UserProfile;
  terms: Term[];
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const CampusStatsReport: React.FC<CampusStatsReportProps> = ({
  userProfile,
  terms,
  addToast,
}) => {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<number | 'all'>('all');
  const [selectedTermId, setSelectedTermId] = useState<number | undefined>();
  const [stats, setStats] = useState<CampusStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load campuses on mount
  useEffect(() => {
    loadCampuses();
  }, [userProfile.school_id]);

  // Load stats when campus or term changes
  useEffect(() => {
    loadStats();
  }, [selectedCampusId, selectedTermId, userProfile.school_id]);

  const loadCampuses = async () => {
    try {
      const campusData = await getCampuses(userProfile.school_id);
      setCampuses(campusData);
    } catch (err) {
      console.error('Error loading campuses:', err);
      addToast('Failed to load campuses', 'error');
    }
  };

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedCampusId === 'all') {
        const allStats = await getAllCampusesStats(userProfile.school_id, selectedTermId);
        setStats(allStats);
      } else {
        const campusStats = await getCampusStats(
          userProfile.school_id,
          selectedCampusId,
          selectedTermId
        );
        setStats([campusStats]);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Failed to load statistics. Please try again.');
      addToast('Failed to load statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const csvContent = exportToCSV(stats);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `campus-statistics-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('Statistics exported successfully', 'success');
    } catch (err) {
      console.error('Error exporting CSV:', err);
      addToast('Failed to export statistics', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate totals across all displayed stats
  const totals = stats.reduce(
    (acc, stat) => ({
      students: acc.students + stat.studentStats.totalStudents,
      activeStudents: acc.activeStudents + stat.studentStats.activeStudents,
      staff: acc.staff + stat.userStats.totalUsers,
      expected: acc.expected + stat.financialStats.totalExpected,
      collected: acc.collected + stat.financialStats.totalCollected,
      outstanding: acc.outstanding + stat.financialStats.totalOutstanding,
    }),
    { students: 0, activeStudents: 0, staff: 0, expected: 0, collected: 0, outstanding: 0 }
  );

  const overallCollectionRate = totals.expected > 0 ? (totals.collected / totals.expected) * 100 : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Campus Statistics Report
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">
            Comprehensive analytics and metrics across all campuses
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
          >
            🖨️ Print
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            📊 Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Campus
            </label>
            <select
              value={selectedCampusId}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all') {
                  setSelectedCampusId('all');
                } else if (value === 'null') {
                  setSelectedCampusId(null as any);
                } else {
                  setSelectedCampusId(Number(value));
                }
              }}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Campuses</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
              <option value="null">No Campus Assigned</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Term (Optional)
            </label>
            <select
              value={selectedTermId || ''}
              onChange={(e) => setSelectedTermId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Terms</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.session_label} - {term.term_label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-6">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Students Card */}
            <div className="rounded-xl border border-slate-200/60 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 backdrop-blur-xl shadow-lg dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total Students
                  </p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                    {formatNumber(totals.students)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatNumber(totals.activeStudents)} active
                  </p>
                </div>
                <div className="text-4xl">👥</div>
              </div>
            </div>

            {/* Total Staff Card */}
            <div className="rounded-xl border border-slate-200/60 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 backdrop-blur-xl shadow-lg dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Active Users
                  </p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-2">
                    {formatNumber(totals.staff)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Staff members
                  </p>
                </div>
                <div className="text-4xl">👨‍🏫</div>
              </div>
            </div>

            {/* Total Expected Card */}
            <div className="rounded-xl border border-slate-200/60 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 backdrop-blur-xl shadow-lg dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total Fees Expected
                  </p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-2">
                    {formatCurrency(totals.expected)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatCurrency(totals.collected)} collected
                  </p>
                </div>
                <div className="text-4xl">💰</div>
              </div>
            </div>

            {/* Collection Rate Card */}
            <div className="rounded-xl border border-slate-200/60 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 backdrop-blur-xl shadow-lg dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Collection Rate
                  </p>
                  <p className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-2">
                    {overallCollectionRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatCurrency(totals.outstanding)} outstanding
                  </p>
                </div>
                <div className="text-4xl">📈</div>
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Detailed Breakdown by Campus
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Campus
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Students
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Active
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Suspended
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Staff
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Expected
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Collected
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Outstanding
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900/20 divide-y divide-slate-200 dark:divide-slate-700">
                  {stats.map((stat, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                        {stat.studentStats.campusName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                        {formatNumber(stat.studentStats.totalStudents)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                        {formatNumber(stat.studentStats.activeStudents)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                        {formatNumber(stat.studentStats.suspendedStudents)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                        {formatNumber(stat.userStats.totalUsers)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                        {formatCurrency(stat.financialStats.totalExpected)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 font-medium">
                        {formatCurrency(stat.financialStats.totalCollected)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400 font-medium">
                        {formatCurrency(stat.financialStats.totalOutstanding)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          stat.financialStats.collectionRate >= 80
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : stat.financialStats.collectionRate >= 50
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {stat.financialStats.collectionRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Additional Stats Cards */}
          {stats.length === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/40">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Fees Owed by Graduated Students
                </h3>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {formatCurrency(stats[0].financialStats.feesOwedByGraduated)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/40">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Fees Owed by Expelled Students
                </h3>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {formatCurrency(stats[0].financialStats.feesOwedByExpelled)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-lg dark:border-slate-700/60 dark:bg-slate-900/40">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Student-to-Staff Ratio
                </h3>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {stats[0].otherStats.studentToStaffRatio.toFixed(1)}:1
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CampusStatsReport;
