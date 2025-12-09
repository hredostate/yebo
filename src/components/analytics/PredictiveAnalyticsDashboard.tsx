import React, { useState } from 'react';
import type { Student } from '../../types';
import EarlyWarningSystem from './EarlyWarningSystem';
import PersonalizedLearningPath from './PersonalizedLearningPath';
import SmartScheduler from './SmartScheduler';
import AutomatedReportWriter from './AutomatedReportWriter';
import { 
  ActivityIcon, 
  BookOpenIcon, 
  CalendarIcon, 
  FileTextIcon, 
  TrendingUpIcon, 
  UsersIcon,
  AlertCircleIcon,
  BrainIcon
} from '../common/icons';

interface PredictiveAnalyticsDashboardProps {
  students: Student[];
  onViewStudent: (student: Student) => void;
}

type TabType = 'overview' | 'early-warning' | 'learning-paths' | 'scheduler' | 'reports';

const PredictiveAnalyticsDashboard: React.FC<PredictiveAnalyticsDashboardProps> = ({
  students,
  onViewStudent,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: TrendingUp },
    { id: 'early-warning' as TabType, label: 'Early Warning', icon: Activity },
    { id: 'learning-paths' as TabType, label: 'Learning Paths', icon: BookOpen },
    { id: 'scheduler' as TabType, label: 'Smart Scheduler', icon: Calendar },
    { id: 'reports' as TabType, label: 'Report Writer', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <BrainIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Predictive Analytics Dashboard
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Machine learning-powered insights for proactive school management
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6">
        <nav className="flex space-x-1" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <ActivityIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">This Month</span>
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  0
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  At-Risk Students
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <BookOpenIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">This Month</span>
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  0
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Learning Paths Generated
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <CalendarIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Current</span>
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  --
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Schedule Score
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <FileTextIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">This Term</span>
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  0
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Reports Generated
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('early-warning')}
                  className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-left"
                >
                  <ActivityIcon className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-red-900 dark:text-red-300">
                      Analyze Student Risks
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-400">
                      Predict at-risk students 2-4 weeks ahead
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('learning-paths')}
                  className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors text-left"
                >
                  <BookOpenIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-indigo-900 dark:text-indigo-300">
                      Generate Learning Path
                    </div>
                    <div className="text-sm text-indigo-700 dark:text-indigo-400">
                      Create personalized curriculum recommendations
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('scheduler')}
                  className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-left"
                >
                  <CalendarIcon className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-green-900 dark:text-green-300">
                      Optimize Schedule
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-400">
                      Generate AI-optimized timetables
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('reports')}
                  className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
                >
                  <FileTextIcon className="w-6 h-6 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-purple-900 dark:text-purple-300">
                      Generate Report Comments
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-400">
                      Auto-generate contextual student comments
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Analytics Accuracy */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Prediction Accuracy Metrics
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Early Warning System
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Based on historical data
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    --
                  </div>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>
            </div>

            {/* Getting Started */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <AlertCircleIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
                    Getting Started with Predictive Analytics
                  </h3>
                  <p className="text-sm text-indigo-800 dark:text-indigo-200 mb-3">
                    The Predictive Analytics Dashboard uses machine learning to provide proactive insights:
                  </p>
                  <ul className="text-sm text-indigo-800 dark:text-indigo-200 space-y-1">
                    <li>• <strong>Early Warning System:</strong> Identifies at-risk students before issues escalate</li>
                    <li>• <strong>Learning Paths:</strong> Personalizes curriculum based on student performance</li>
                    <li>• <strong>Smart Scheduler:</strong> Optimizes timetables using constraint satisfaction</li>
                    <li>• <strong>Report Writer:</strong> Generates contextual comments using AI</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'early-warning' && (
          <EarlyWarningSystem students={students} onViewStudent={onViewStudent} />
        )}

        {activeTab === 'learning-paths' && (
          <PersonalizedLearningPath students={students} />
        )}

        {activeTab === 'scheduler' && (
          <SmartScheduler />
        )}

        {activeTab === 'reports' && (
          <AutomatedReportWriter students={students} />
        )}
      </div>
    </div>
  );
};

export default PredictiveAnalyticsDashboard;
