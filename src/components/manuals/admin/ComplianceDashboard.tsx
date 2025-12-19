import React, { useState, useEffect } from 'react';
import { ChartBarIcon } from '../../common/icons';
import { useComplianceStats } from '../hooks/useComplianceStats';
import type { ComplianceDashboardData } from '../../../types/manuals';
import Spinner from '../../common/Spinner';

interface ComplianceDashboardProps {
  schoolId: number;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ schoolId, addToast }) => {
  const [data, setData] = useState<ComplianceDashboardData | null>(null);
  const { loading, error, fetchDashboardData } = useComplianceStats(schoolId);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (error) {
      addToast(error, 'error');
    }
  }, [error]);

  const loadData = async () => {
    const result = await fetchDashboardData();
    if (result) {
      setData(result);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No compliance data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Manuals</div>
          <div className="text-3xl font-bold text-slate-800 dark:text-white">
            {data.overall_stats.total_manuals}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Assignments</div>
          <div className="text-3xl font-bold text-slate-800 dark:text-white">
            {data.overall_stats.total_assignments}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Completion Rate</div>
          <div className="text-3xl font-bold text-green-600">
            {data.overall_stats.overall_completion_rate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Overdue</div>
          <div className="text-3xl font-bold text-red-600">
            {data.overall_stats.total_overdue}
          </div>
        </div>
      </div>

      {/* By Manual Stats */}
      {data.by_manual.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold mb-4">Completion by Manual</h2>
          <div className="space-y-3">
            {data.by_manual.map(manual => (
              <div key={manual.manual_id} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-medium text-slate-800 dark:text-white">
                    {manual.manual_title}
                  </div>
                  <div className="text-xs text-slate-500">
                    {manual.completed}/{manual.total_assigned} completed
                  </div>
                </div>
                <div className="flex-1 max-w-md">
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${manual.completion_rate}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-800 dark:text-white">
                    {manual.completion_rate.toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Users */}
      {data.overdue_users.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold mb-4 text-red-600">Overdue Assignments</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 text-sm font-semibold">User</th>
                  <th className="text-left py-2 text-sm font-semibold">Manual</th>
                  <th className="text-left py-2 text-sm font-semibold">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.overdue_users.map((user, idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/50">
                    <td className="py-3">
                      <div className="font-medium">{user.user_name}</div>
                      <div className="text-xs text-slate-500">{user.user_role}</div>
                    </td>
                    <td className="py-3 text-sm">{user.manual_title}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded text-xs font-semibold">
                        {user.days_overdue} days
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Completions */}
      {data.recent_completions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold mb-4">Recent Completions</h2>
          <div className="space-y-2">
            {data.recent_completions.slice(0, 5).map((completion, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                <div>
                  <div className="font-medium">{completion.user_name}</div>
                  <div className="text-sm text-slate-500">{completion.manual_title}</div>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(completion.completed_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceDashboard;
