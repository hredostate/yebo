import React, { useState, lazy, Suspense } from 'react';
import type { UserProfile } from '../types';
import { SettingsIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS } from '../constants';

// Lazy load sub-components
const SettingsView = lazy(() => import('./SettingsView'));
const LessonPlanSubmissionSettings = lazy(() => import('./LessonPlanSubmissionSettings'));

interface SettingsHubProps {
  userProfile: UserProfile;
  userPermissions: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
  currentView: string;
}

type SettingsSection = 'general' | 'submissions';

const SettingsHub: React.FC<SettingsHubProps> = ({
  userProfile,
  userPermissions,
  addToast,
  onNavigate,
  currentView
}) => {
  const isAllPowerful = userPermissions.includes('*');
  const canManageSettings = isAllPowerful || userPermissions.includes('manage-settings');

  // Determine initial section based on current view
  const getInitialSection = (): SettingsSection => {
    if (currentView === VIEWS.SETTINGS) return 'general';
    if (currentView === VIEWS.SUBMISSION_SETTINGS) return 'submissions';
    // Default to first accessible section
    return 'general';
  };

  const [activeSection, setActiveSection] = useState<SettingsSection>(getInitialSection());

  const navSections = [
    { id: 'general' as const, label: 'General', show: canManageSettings },
    { id: 'submissions' as const, label: 'Submissions', show: canManageSettings },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <Suspense fallback={<Spinner />}>
            <SettingsView userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'submissions':
        return (
          <Suspense fallback={<Spinner />}>
            <LessonPlanSubmissionSettings userProfile={userProfile} addToast={addToast} />
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
            <SettingsIcon className="w-8 h-8 text-slate-600" />
            Settings Hub
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Manage system settings and configurations.</p>
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {navSections.filter(s => s.show).map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg ${
              activeSection === section.id
                ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b-2 border-slate-600 dark:border-slate-400'
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

export default SettingsHub;
