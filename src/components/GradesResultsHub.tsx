import React, { useState, lazy, Suspense } from 'react';
import type { UserProfile } from '../types';
import { ChartBarIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS } from '../constants';

// Lazy load sub-components
const TeacherGradebookView = lazy(() => import('./TeacherGradebookView'));
const AssessmentManager = lazy(() => import('./AssessmentManager'));
const ResultManager = lazy(() => import('./ResultManager'));
const ScoreReviewView = lazy(() => import('./ScoreReviewView'));

interface GradesResultsHubProps {
  userProfile: UserProfile;
  userPermissions: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
  currentView: string;
}

type GradesSection = 'gradebook' | 'assessments' | 'results' | 'review';

const GradesResultsHub: React.FC<GradesResultsHubProps> = ({
  userProfile,
  userPermissions,
  addToast,
  onNavigate,
  currentView
}) => {
  const isAllPowerful = userPermissions.includes('*');
  const canEditScores = isAllPowerful || userPermissions.includes('score_entries.edit_self');
  const canPublishResults = isAllPowerful || userPermissions.includes('results.lock_and_publish');
  const canViewAllScores = isAllPowerful || userPermissions.includes('score_entries.view_all');

  // Determine initial section based on current view
  const getInitialSection = (): GradesSection => {
    if (currentView === VIEWS.GRADEBOOK) return 'gradebook';
    if (currentView === VIEWS.ASSESSMENT_MANAGER) return 'assessments';
    if (currentView === VIEWS.RESULT_MANAGER) return 'results';
    if (currentView === VIEWS.SCORE_REVIEW) return 'review';
    // Default to first accessible section
    if (canEditScores) return 'gradebook';
    if (canViewAllScores) return 'review';
    return 'gradebook';
  };

  const [activeSection, setActiveSection] = useState<GradesSection>(getInitialSection());

  const navSections = [
    { id: 'gradebook' as const, label: 'Gradebook', show: canEditScores },
    { id: 'assessments' as const, label: 'Assessments', show: canEditScores },
    { id: 'results' as const, label: 'Results', show: canPublishResults },
    { id: 'review' as const, label: 'Review', show: canViewAllScores },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'gradebook':
        return (
          <Suspense fallback={<Spinner />}>
            <TeacherGradebookView userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'assessments':
        return (
          <Suspense fallback={<Spinner />}>
            <AssessmentManager userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'results':
        return (
          <Suspense fallback={<Spinner />}>
            <ResultManager userProfile={userProfile} addToast={addToast} onNavigate={onNavigate} />
          </Suspense>
        );
      case 'review':
        return (
          <Suspense fallback={<Spinner />}>
            <ScoreReviewView userProfile={userProfile} addToast={addToast} />
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
            <ChartBarIcon className="w-8 h-8 text-green-600" />
            Grades & Results
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Manage gradebook, assessments, and results.</p>
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
                ? 'bg-white dark:bg-slate-900 text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
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

export default GradesResultsHub;
