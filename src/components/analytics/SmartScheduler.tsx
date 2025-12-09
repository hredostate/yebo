import React, { useState } from 'react';
import type { TimetableEntry, ScheduleOptimizationResult } from '../../types';
import { optimizeSchedule, commonConstraints } from '../../services/scheduleOptimizer';
import { CalendarIcon, ClockIcon, UsersIcon, CheckCircleIcon, XCircleIcon } from '../common/icons';

const SmartScheduler: React.FC = () => {
  const [optimizationResult, setOptimizationResult] = useState<ScheduleOptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const generateSchedule = async () => {
    setLoading(true);
    
    try {
      // Mock scheduling request - in production, fetch from API
      const request = {
        classes: [
          { classId: 1, className: 'JSS 1A' },
          { classId: 2, className: 'JSS 1B' },
        ],
        subjects: [
          { subjectId: 1, subjectName: 'Mathematics', periodsPerWeek: 5 },
          { subjectId: 2, subjectName: 'English', periodsPerWeek: 5 },
          { subjectId: 3, subjectName: 'Science', periodsPerWeek: 4, requiresLab: true },
        ],
        teachers: [
          {
            teacherId: 'teacher1',
            teacherName: 'Mr. Johnson',
            unavailablePeriods: [],
            maxConsecutivePeriods: 6,
          },
        ],
        rooms: [
          { roomId: 1, roomName: 'Room 101', capacity: 40, type: 'classroom' as const },
          { roomId: 2, roomName: 'Science Lab', capacity: 30, type: 'lab' as const },
        ],
        constraints: [
          commonConstraints.noTeacherDoubleBooking(),
          commonConstraints.noClassDoubleBooking(),
          commonConstraints.noRoomDoubleBooking(),
          commonConstraints.balancedDailyLoad(),
          commonConstraints.difficultSubjectsInMorning(),
        ],
      };

      const result = optimizeSchedule(request);
      setOptimizationResult(result);
    } catch (error) {
      console.error('Error generating schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6" />
            Smart Schedule Optimizer
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            AI-optimized timetables using constraint satisfaction algorithms
          </p>
        </div>
        <button
          onClick={generateSchedule}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Optimizing...' : 'Generate Schedule'}
        </button>
      </div>

      {optimizationResult && (
        <div className="space-y-6">
          {/* Optimization Score */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Optimization Score
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Based on constraint satisfaction and workload balance
                </p>
              </div>
              <div className={`text-5xl font-bold ${getScoreColor(optimizationResult.score)}`}>
                {optimizationResult.score}/100
              </div>
            </div>
          </div>

          {/* Constraints Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                Satisfied Constraints
              </h3>
              <ul className="space-y-2">
                {optimizationResult.satisfiedConstraints.map((constraint, idx) => (
                  <li key={idx} className="text-sm text-slate-600 dark:text-slate-400 flex items-start">
                    <CheckCircleIcon className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                    {constraint}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <XCircleIcon className="w-5 h-5 text-red-600" />
                Violated Constraints
              </h3>
              {optimizationResult.violatedConstraints.length > 0 ? (
                <ul className="space-y-2">
                  {optimizationResult.violatedConstraints.map((constraint, idx) => (
                    <li key={idx} className="text-sm text-slate-600 dark:text-slate-400 flex items-start">
                      <XCircleIcon className="w-4 h-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                      {constraint}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-green-600 dark:text-green-400">
                  All constraints satisfied!
                </p>
              )}
            </div>
          </div>

          {/* Schedule Preview */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5" />
              Generated Schedule ({optimizationResult.schedule.length} periods)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Day
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Period
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Time
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Subject
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Class
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Teacher
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Room
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {optimizationResult.schedule.slice(0, 20).map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-4 py-2 text-sm text-slate-900 dark:text-white">
                        {entry.day}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                        {entry.period}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                        {entry.startTime} - {entry.endTime}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-900 dark:text-white font-medium">
                        {entry.subjectName}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                        {entry.className}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                        {entry.teacherName}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                        {entry.roomName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {optimizationResult.schedule.length > 20 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 text-center">
                Showing first 20 of {optimizationResult.schedule.length} periods
              </p>
            )}
          </div>

          {/* Suggestions */}
          {optimizationResult.suggestions.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-3">
                Optimization Suggestions
              </h3>
              <ul className="space-y-2">
                {optimizationResult.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                    • {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!optimizationResult && !loading && (
        <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-12 text-center">
          <CalendarIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Click "Generate Schedule" to optimize your timetable
          </p>
        </div>
      )}
    </div>
  );
};

export default SmartScheduler;
