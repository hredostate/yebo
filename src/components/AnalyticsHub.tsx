import React, { useState, lazy, Suspense } from 'react';
import type { UserProfile } from '../types';
import { ChartBarIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS } from '../constants';

// Lazy load sub-components
const AnalyticsView = lazy(() => import('./AnalyticsView'));
const DataAnalysisView = lazy(() => import('./DataAnalysisView'));
const CampusStatsReport = lazy(() => import('./CampusStatsReport'));
const AIStrategicCenterView = lazy(() => import('./AIStrategicCenterView'));

interface AnalyticsHubProps {
  userProfile: UserProfile;
  userPermissions: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
  currentView: string;
}

type AnalyticsSection = 'dashboard' | 'ai_analysis' | 'campus_stats' | 'predictions' | 'strategic';

const AnalyticsHub: React.FC<AnalyticsHubProps> = ({
  userProfile,
  userPermissions,
  addToast,
  onNavigate,
  currentView
}) => {
  const isAllPowerful = userPermissions.includes('*');
  const canViewAnalytics = isAllPowerful || userPermissions.includes('view-analytics');
  const canViewCampusStats = isAllPowerful || userPermissions.includes('view-campus-stats');
  const canViewPredictive = isAllPowerful || userPermissions.includes('view-predictive-analytics');
  const canViewSchoolHealth = isAllPowerful || userPermissions.includes('view-school-health-overview');

  // Determine initial section based on current view
  const getInitialSection = (): AnalyticsSection => {
    if (currentView === VIEWS.ANALYTICS) return 'dashboard';
    if (currentView === VIEWS.DATA_ANALYSIS) return 'ai_analysis';
    if (currentView === VIEWS.CAMPUS_STATISTICS) return 'campus_stats';
    if (currentView === VIEWS.PREDICTIVE_ANALYTICS) return 'predictions';
    if (currentView === VIEWS.AI_STRATEGIC_CENTER) return 'strategic';
    // Default to first accessible section
    if (canViewAnalytics) return 'dashboard';
    if (canViewSchoolHealth) return 'strategic';
    return 'dashboard';
  };

  const [activeSection, setActiveSection] = useState<AnalyticsSection>(getInitialSection());

  const navSections = [
    { id: 'dashboard' as const, label: 'Dashboard', show: canViewAnalytics },
    { id: 'ai_analysis' as const, label: 'AI Analysis', show: canViewAnalytics },
    { id: 'campus_stats' as const, label: 'Campus Stats', show: canViewCampusStats },
    { id: 'predictions' as const, label: 'Predictions', show: canViewPredictive },
    { id: 'strategic' as const, label: 'Strategic', show: canViewSchoolHealth },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <Suspense fallback={<Spinner />}>
            <AnalyticsView userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'ai_analysis':
        return (
          <Suspense fallback={<Spinner />}>
            <DataAnalysisView addToast={addToast} />
          </Suspense>
        );
      case 'campus_stats':
        return (
          <Suspense fallback={<Spinner />}>
            <CampusStatsReport userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'predictions':
        // Note: PredictiveAnalyticsDashboard requires complex props not available at hub level
        // So we navigate to the actual view instead of rendering inline
        onNavigate(VIEWS.PREDICTIVE_ANALYTICS);
        return (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400">Redirecting to Predictive Analytics...</p>
          </div>
        );
      case 'strategic':
        return (
          <Suspense fallback={<Spinner />}>
            <AIStrategicCenterView userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      default:
        return (
          <div className="text-center py-8 text-slate-500">
            <p>Section not found. Please select a valid option from the menu.</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <ChartBarIcon className="w-8 h-8 text-purple-600" />
            Analytics & Insights
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Access analytics, AI insights, and predictive data.</p>
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {navSections.filter(s => s.show).map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg whitespace-nowrap ${
              activeSection === section.id
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 shadow-xl min-h-[60vh]">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default AnalyticsHub;
